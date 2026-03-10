import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  appCollectDiagnostics,
  appGetStartupStatus,
  appRetryStartup,
  formatPlatformTs,
  type StartupStatusSnapshot,
} from '../runtime/api';

const badgeClassForStatus = (status: string): string => {
  if (status === 'ready' || status === 'pass') {
    return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30';
  }
  if (status === 'blocked' || status === 'fail') {
    return 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30';
  }
  if (status === 'degraded' || status === 'warn') {
    return 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30';
  }
  return 'bg-slate-800 text-slate-200 ring-1 ring-slate-700';
};

const statusLabel = (status: string): string => {
  if (!status) {
    return 'Unknown';
  }
  return status.replaceAll('_', ' ');
};

async function copyToClipboard(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

function StepList({ snapshot }: { snapshot: StartupStatusSnapshot }) {
  if (snapshot.steps.length === 0) {
    return <p className="text-sm text-[color:var(--kt-text-secondary)]">No startup steps recorded yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {snapshot.steps.map((step) => (
        <li className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3" key={step.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[color:var(--kt-text-primary)]">{step.label}</p>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${badgeClassForStatus(step.status)}`}>
              {statusLabel(step.status)}
            </span>
          </div>
          <p className="mt-2 text-sm text-[color:var(--kt-text-secondary)]">{step.message}</p>
          <p className="mt-2 text-xs text-[color:var(--kt-text-muted)]">Updated {formatPlatformTs(step.lastUpdatedAt)}</p>
        </li>
      ))}
    </ul>
  );
}

export function StartupStatusPanel() {
  const queryClient = useQueryClient();
  const [panelMessage, setPanelMessage] = useState('');
  const [panelError, setPanelError] = useState('');

  const startupQuery = useQuery({
    queryKey: ['platform', 'startup'],
    queryFn: appGetStartupStatus,
  });

  const retryMutation = useMutation({
    mutationFn: appRetryStartup,
    onMutate: () => {
      setPanelMessage('');
      setPanelError('');
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(['platform', 'startup'], snapshot);
      setPanelMessage('Startup retry triggered.');
    },
    onError: (error) => {
      setPanelError(error instanceof Error ? error.message : 'Failed to retry startup.');
    },
  });

  const diagnosticsMutation = useMutation({
    mutationFn: appCollectDiagnostics,
    onMutate: () => {
      setPanelMessage('');
      setPanelError('');
    },
    onSuccess: (bundle) => {
      void queryClient.invalidateQueries({ queryKey: ['platform', 'startup'] });
      setPanelMessage(`Diagnostics saved to ${bundle.path}`);
    },
    onError: (error) => {
      setPanelError(error instanceof Error ? error.message : 'Failed to collect diagnostics.');
    },
  });

  const snapshot = startupQuery.data;

  return (
    <section className="kt-panel-elevated space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="kt-title-lg">Startup and Runtime</h3>
          <p className="mt-1 text-sm text-[color:var(--kt-text-secondary)]">
            Korda Tools now owns local startup orchestration. The app manages initialization, service checks, and recovery from here.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${badgeClassForStatus(
            snapshot?.overallStatus ?? 'unknown',
          )}`}
        >
          {statusLabel(snapshot?.overallStatus ?? 'unknown')}
        </span>
      </div>

      {snapshot ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="kt-kv">
              <p className="kt-title-sm">Summary</p>
              <p className="mt-1 text-sm text-[color:var(--kt-text-primary)]">{snapshot.message}</p>
            </div>
            <div className="kt-kv">
              <p className="kt-title-sm">Last Attempt</p>
              <p className="mt-1 text-sm text-[color:var(--kt-text-primary)]">{formatPlatformTs(snapshot.lastAttemptedAt)}</p>
            </div>
            <div className="kt-kv">
              <p className="kt-title-sm">Last Ready</p>
              <p className="mt-1 text-sm text-[color:var(--kt-text-primary)]">
                {formatPlatformTs(snapshot.lastSuccessfulStartupAt)}
              </p>
            </div>
            <div className="kt-kv">
              <p className="kt-title-sm">Attempts</p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--kt-text-primary)]">{snapshot.startupAttemptCount}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
              <p className="kt-title-sm">Local Paths</p>
              <dl className="mt-3 space-y-2 text-xs text-[color:var(--kt-text-secondary)]">
                <div>
                  <dt className="font-semibold text-[color:var(--kt-text-primary)]">App Data</dt>
                  <dd className="break-all">{snapshot.appDataDir}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[color:var(--kt-text-primary)]">Logs</dt>
                  <dd className="break-all">{snapshot.appLogDir}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[color:var(--kt-text-primary)]">Diagnostics</dt>
                  <dd className="break-all">{snapshot.diagnosticsDir}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[color:var(--kt-text-primary)]">Temp</dt>
                  <dd className="break-all">{snapshot.tempDir}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
              <p className="kt-title-sm">Recovery</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="kt-btn kt-btn-secondary"
                  disabled={retryMutation.isPending}
                  onClick={() => {
                    void retryMutation.mutateAsync();
                  }}
                  type="button"
                >
                  {retryMutation.isPending ? 'Retrying...' : 'Retry Startup'}
                </button>
                <button
                  className="kt-btn kt-btn-secondary"
                  disabled={diagnosticsMutation.isPending}
                  onClick={() => {
                    void diagnosticsMutation.mutateAsync();
                  }}
                  type="button"
                >
                  {diagnosticsMutation.isPending ? 'Collecting...' : 'Collect Diagnostics'}
                </button>
                {snapshot.latestDiagnosticsPath ? (
                  <button
                    className="kt-btn kt-btn-ghost"
                    onClick={() => {
                      void copyToClipboard(snapshot.latestDiagnosticsPath ?? '');
                      setPanelMessage('Diagnostics path copied to clipboard.');
                    }}
                    type="button"
                  >
                    Copy Diagnostics Path
                  </button>
                ) : null}
              </div>
              {snapshot.lastErrorSummary ? (
                <p className="mt-3 text-sm text-[color:var(--kt-danger)]">{snapshot.lastErrorSummary}</p>
              ) : null}
              {snapshot.latestDiagnosticsPath ? (
                <p className="mt-3 break-all text-xs text-[color:var(--kt-text-secondary)]">
                  Latest diagnostics: {snapshot.latestDiagnosticsPath}
                </p>
              ) : null}
            </div>
          </div>

          {snapshot.runtimeReadiness ? (
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="kt-title-sm">Managed Service Health</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${badgeClassForStatus(
                    snapshot.runtimeReadiness.state,
                  )}`}
                >
                  {statusLabel(snapshot.runtimeReadiness.state)}
                </span>
              </div>
              <p className="mt-2 text-sm text-[color:var(--kt-text-secondary)]">{snapshot.runtimeReadiness.summary}</p>
              <ul className="mt-3 space-y-2">
                {snapshot.runtimeReadiness.checks.map((check) => (
                  <li className="rounded-lg border border-slate-800 bg-slate-950 p-3" key={check.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[color:var(--kt-text-primary)]">{check.title}</p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${badgeClassForStatus(
                          check.status,
                        )}`}
                      >
                        {statusLabel(check.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[color:var(--kt-text-secondary)]">{check.message}</p>
                    {check.remediation.length > 0 ? (
                      <p className="mt-2 text-xs text-[color:var(--kt-text-muted)]">
                        Repair: {check.remediation.join(' | ')}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="kt-title-sm mb-3">Startup Steps</p>
            <StepList snapshot={snapshot} />
          </div>
        </>
      ) : startupQuery.isLoading ? (
        <p className="text-sm text-[color:var(--kt-text-secondary)]">Loading startup supervisor state...</p>
      ) : (
        <p className="text-sm text-[color:var(--kt-danger)]">Unable to load startup status.</p>
      )}

      {panelMessage ? <p className="text-sm text-emerald-300">{panelMessage}</p> : null}
      {panelError ? <p className="text-sm text-[color:var(--kt-danger)]">{panelError}</p> : null}
    </section>
  );
}

