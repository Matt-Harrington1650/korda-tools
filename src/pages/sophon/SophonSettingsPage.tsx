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
    <section className="kt-panel space-y-4 p-4">
      <h3 className="kt-title-lg">SOPHON Advanced Settings</h3>

      <article className="kt-panel-muted border-blue-400/40 p-4">
        <h4 className="text-sm font-semibold text-[color:var(--kt-accent-hover)]">NVIDIA API Key</h4>
        <p className="mt-1 text-xs text-[color:var(--kt-text-secondary)]">
          Save once, then open SOPHON and start ingesting/querying immediately. The key is stored in OS secure keychain.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            className="kt-input"
            onChange={(event) => {
              setApiKey(event.target.value);
            }}
            placeholder="nvapi-..."
            type="password"
            value={apiKey}
          />
          <button className="kt-btn kt-btn-primary" disabled={savingApiKey} onClick={saveApiKey} type="button">
            Save Key
          </button>
          <button className="kt-btn kt-btn-secondary" disabled={savingApiKey || !hasStoredApiKey} onClick={clearApiKey} type="button">
            Clear Key
          </button>
        </div>
        <p className="mt-2 text-xs text-[color:var(--kt-text-muted)]">Stored key: {hasStoredApiKey ? 'Present' : 'Not set'}</p>
        {latestRuntimeIssue ? (
          <p className="kt-panel-muted mt-2 border-amber-400/40 px-2 py-1 text-xs text-[color:var(--kt-warning)]">
            Runtime warning: {latestRuntimeIssue.message}
          </p>
        ) : null}
      </article>

      <article className="kt-panel-muted p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-[color:var(--kt-text-primary)]">Enterprise Readiness</h4>
            <p className="mt-1 text-xs text-[color:var(--kt-text-muted)]">
              Validates API key, bridge initialization, Milvus/ingestion dependencies, retrieval dependencies, and collection bootstrap.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="kt-btn kt-btn-secondary"
              disabled={runningReadinessCheck}
              onClick={() => {
                void runReadinessCheck();
              }}
              type="button"
            >
              {runningReadinessCheck ? 'Checking...' : 'Run Readiness Check'}
            </button>
            <button className="kt-btn kt-btn-secondary" disabled={runningAutoRemediation} onClick={runAutoRemediation} type="button">
              {runningAutoRemediation ? 'Remediating...' : 'Auto Remediate'}
            </button>
          </div>
        </div>
        {readiness ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-[color:var(--kt-text-secondary)]">
              Status: <span className="font-semibold uppercase">{readiness.state}</span> | Blockers: {readiness.blockerCount} | Warnings:{' '}
              {readiness.warningCount}
            </p>
            <p className="kt-kv text-xs">{readiness.summary}</p>
            <ul className="space-y-2">
              {readiness.checks.map((check) => (
                <li
                  key={check.id}
                  className={`kt-panel-muted px-3 py-2 text-xs ${
                    check.status === 'pass'
                      ? 'border-emerald-400/40 text-[color:var(--kt-success)]'
                      : check.status === 'warn'
                        ? 'border-amber-400/40 text-[color:var(--kt-warning)]'
                        : 'border-rose-400/40 text-[color:var(--kt-danger)]'
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
          <p className="kt-panel-muted mt-3 px-3 py-2 text-xs text-[color:var(--kt-text-muted)]">
            No readiness report yet. Run a readiness check to verify dependencies and clear degraded mode warnings.
          </p>
        )}
      </article>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p className="kt-kv">Offline-only lock: {state.offlineOnlyEnforced ? 'Enabled' : 'Disabled'}</p>
        <p className="kt-kv">Egress block: {state.egressBlocked ? 'Enabled' : 'Disabled'}</p>
        <p className="kt-kv">Engine mode: {state.runtime.engineMode}</p>
        <p className="kt-kv">Transport: {state.runtime.transport}</p>
      </div>
      <label className="kt-panel-muted flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--kt-text-secondary)]">
        <input
          checked={!state.egressBlocked}
          className="kt-checkbox"
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
          className="kt-btn kt-btn-secondary"
          onClick={() => {
            runHealthCheck();
            setMessage('Runtime health + telemetry cache refreshed.');
          }}
          type="button"
        >
          Refresh Runtime Cache
        </button>
        <button
          className="kt-btn kt-btn-secondary"
          onClick={() => {
            recordBlockedEgressAttempt('https://blocked.invalid', 'SOPHON_EGRESS_BLOCK_REQUIRED');
            setMessage('Synthetic blocked-egress evidence recorded.');
          }}
          type="button"
        >
          Test Offline Gate
        </button>
      </div>
      {message ? <p className="mt-2 text-sm text-[color:var(--kt-text-secondary)]">{message}</p> : null}
    </section>
  );
}

