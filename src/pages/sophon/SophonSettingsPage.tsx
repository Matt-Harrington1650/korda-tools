import { useEffect, useMemo, useState } from 'react';
import { createSecretVault } from '../../desktop';
import {
  isSophonRuntimeBridgeEnabled,
  sophonRuntimeAutoRemediate,
  sophonRuntimeCheckReadiness,
  sophonRuntimeShutdown,
} from '../../features/sophon/runtime/sophonRuntimeBridge';
import { useSophonStore } from '../../features/sophon/store/sophonStore';

const SOPHON_NVIDIA_API_KEY_CREDENTIAL_ID = 'sophon.nvidia.api_key';

export function SophonSettingsPage() {
  const state = useSophonStore((store) => store.state);
  const startRuntime = useSophonStore((store) => store.startRuntime);
  const runHealthCheck = useSophonStore((store) => store.runHealthCheck);
  const recordBlockedEgressAttempt = useSophonStore((store) => store.recordBlockedEgressAttempt);
  const setEgressBlocked = useSophonStore((store) => store.setEgressBlocked);
  const secretVault = useMemo(() => createSecretVault(), []);
  const latestRuntimeIssue = state.logs.find(
    (entry) => entry.source === 'runtime' && (entry.severity === 'warn' || entry.severity === 'error'),
  );
  const [apiKey, setApiKey] = useState('');
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [runningReadinessCheck, setRunningReadinessCheck] = useState(false);
  const [runningAutoRemediation, setRunningAutoRemediation] = useState(false);
  const [message, setMessage] = useState('');
  const readiness = state.runtimeReadiness;
  const runtimeBridgeEnabled = useMemo(() => isSophonRuntimeBridgeEnabled(), []);

  const describeError = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const existing = await secretVault.getSecret(SOPHON_NVIDIA_API_KEY_CREDENTIAL_ID);
        if (existing.trim().length > 0) {
          setHasStoredApiKey(true);
        }
      } catch {
        setHasStoredApiKey(false);
      }
    })();
  }, [secretVault]);

  useEffect(() => {
    if (!runtimeBridgeEnabled) {
      return;
    }
    void runReadinessCheck(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeBridgeEnabled]);

  async function runReadinessCheck(announceSuccess = true): Promise<void> {
    if (!runtimeBridgeEnabled) {
      runHealthCheck();
      if (announceSuccess) {
        setMessage('Runtime bridge unavailable in browser mode; refreshed local Sophon state only.');
      }
      return;
    }
    setRunningReadinessCheck(true);
    try {
      await sophonRuntimeCheckReadiness();
      runHealthCheck();
      if (announceSuccess) {
        setMessage('Enterprise readiness check completed. Review dependency status below.');
      }
    } catch (error) {
      const reason = describeError(error);
      setMessage(`Readiness check failed: ${reason}`);
    } finally {
      setRunningReadinessCheck(false);
    }
  }

  const runAutoRemediation = (): void => {
    if (!runtimeBridgeEnabled) {
      setMessage('Auto remediation is available in desktop runtime only.');
      return;
    }
    void (async () => {
      setRunningAutoRemediation(true);
      try {
        const result = await sophonRuntimeAutoRemediate();
        runHealthCheck();
        const actionSummary = result.actions.length > 0 ? result.actions.join(' | ') : 'No remediation actions were required.';
        setMessage(`Auto remediation finished: ${actionSummary}`);
      } catch (error) {
        const reason = describeError(error);
        setMessage(`Auto remediation failed: ${reason}`);
      } finally {
        setRunningAutoRemediation(false);
      }
    })();
  };

  const saveApiKey = (): void => {
    void (async () => {
      const trimmed = apiKey.trim();
      if (trimmed.length === 0) {
        setMessage('Enter an NVIDIA API key before saving.');
        return;
      }
      setSavingApiKey(true);
      try {
        await secretVault.setSecret(SOPHON_NVIDIA_API_KEY_CREDENTIAL_ID, trimmed);
        setEgressBlocked(false);
        setHasStoredApiKey(true);
        setApiKey('');
        setMessage('Sophon API key saved. Restarting runtime with hosted NVIDIA acceleration enabled...');
        await sophonRuntimeShutdown();
        startRuntime();
        runHealthCheck();
        await runReadinessCheck(false);
      } catch (error) {
        const reason = describeError(error);
        setMessage(`Failed to save Sophon API key: ${reason}`);
      } finally {
        setSavingApiKey(false);
      }
    })();
  };

  const clearApiKey = (): void => {
    void (async () => {
      setSavingApiKey(true);
      try {
        await secretVault.deleteSecret(SOPHON_NVIDIA_API_KEY_CREDENTIAL_ID);
        setEgressBlocked(true);
        setApiKey('');
        setHasStoredApiKey(false);
        setMessage('Sophon API key removed. Runtime reverted to no-key mode.');
        await sophonRuntimeShutdown();
        runHealthCheck();
        await runReadinessCheck(false);
      } catch (error) {
        const reason = describeError(error);
        setMessage(`Failed to delete Sophon API key: ${reason}`);
      } finally {
        setSavingApiKey(false);
      }
    })();
  };

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">Sophon Advanced Settings</h3>

      <article className="rounded border border-blue-200 bg-blue-50 p-4">
        <h4 className="text-sm font-semibold text-blue-900">NVIDIA API Key</h4>
        <p className="mt-1 text-xs text-blue-800">
          Save once, then open Sophon and start ingesting/querying immediately. The key is stored in OS secure keychain.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            className="w-full rounded border border-blue-300 bg-white px-3 py-2 text-sm"
            onChange={(event) => {
              setApiKey(event.target.value);
            }}
            placeholder="nvapi-..."
            type="password"
            value={apiKey}
          />
          <button
            className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={savingApiKey}
            onClick={saveApiKey}
            type="button"
          >
            Save Key
          </button>
          <button
            className="rounded border border-blue-300 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={savingApiKey || !hasStoredApiKey}
            onClick={clearApiKey}
            type="button"
          >
            Clear Key
          </button>
        </div>
        <p className="mt-2 text-xs text-blue-800">Stored key: {hasStoredApiKey ? 'Present' : 'Not set'}</p>
        {latestRuntimeIssue ? (
          <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
            Runtime warning: {latestRuntimeIssue.message}
          </p>
        ) : null}
      </article>

      <article className="rounded border border-blue-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Enterprise Readiness</h4>
            <p className="mt-1 text-xs text-slate-600">
              Validates API key, bridge initialization, Milvus/ingestion dependencies, retrieval dependencies, and collection bootstrap.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={runningReadinessCheck}
              onClick={() => {
                void runReadinessCheck();
              }}
              type="button"
            >
              {runningReadinessCheck ? 'Checking...' : 'Run Readiness Check'}
            </button>
            <button
              className="rounded border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={runningAutoRemediation}
              onClick={runAutoRemediation}
              type="button"
            >
              {runningAutoRemediation ? 'Remediating...' : 'Auto Remediate'}
            </button>
          </div>
        </div>
        {readiness ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-700">
              Status: <span className="font-semibold uppercase">{readiness.state}</span> | Blockers: {readiness.blockerCount} | Warnings:{' '}
              {readiness.warningCount}
            </p>
            <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">{readiness.summary}</p>
            <ul className="space-y-2">
              {readiness.checks.map((check) => (
                <li
                  key={check.id}
                  className={`rounded border px-3 py-2 text-xs ${
                    check.status === 'pass'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : check.status === 'warn'
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : 'border-rose-300 bg-rose-50 text-rose-900'
                  }`}
                >
                  <p className="font-semibold">
                    {check.title} ({check.status.toUpperCase()})
                  </p>
                  <p className="mt-1">{check.message}</p>
                  {check.remediation.length > 0 ? (
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {check.remediation.map((step, index) => (
                        <li key={`${check.id}-fix-${index}`}>{step}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            No readiness report yet. Run a readiness check to verify dependencies and clear degraded mode warnings.
          </p>
        )}
      </article>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          Offline-only lock: {state.offlineOnlyEnforced ? 'Enabled' : 'Disabled'}
        </p>
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          Egress block: {state.egressBlocked ? 'Enabled' : 'Disabled'}
        </p>
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          Engine mode: {state.runtime.engineMode}
        </p>
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          Transport: {state.runtime.transport}
        </p>
      </div>
      <label className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <input
          checked={!state.egressBlocked}
          onChange={(event) => {
            setEgressBlocked(!event.target.checked);
            setMessage(
              event.target.checked
                ? 'Hosted inference egress enabled for faster NVIDIA-backed responses.'
                : 'Hosted inference egress blocked. Sophon will remain strictly offline.',
            );
          }}
          type="checkbox"
        />
        Allow hosted NVIDIA inference egress (recommended for performance)
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          onClick={() => {
            runHealthCheck();
            setMessage('Runtime health + telemetry cache refreshed.');
          }}
          type="button"
        >
          Refresh Runtime Cache
        </button>
        <button
          className="rounded border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          onClick={() => {
            recordBlockedEgressAttempt('https://blocked.invalid', 'SOPHON_EGRESS_BLOCK_REQUIRED');
            setMessage('Synthetic blocked-egress evidence recorded.');
          }}
          type="button"
        >
          Test Offline Gate
        </button>
      </div>
      {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}

