import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createUpdaterService,
  type UpdateCheckResult,
  type UpdateInstallProgress,
} from '../../../desktop';
import { formatPlatformTs } from '../runtime/api';

const badgeClassForStatus = (status: 'ok' | 'warn' | 'idle'): string => {
  if (status === 'ok') {
    return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30';
  }
  if (status === 'warn') {
    return 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30';
  }
  return 'bg-slate-800 text-slate-200 ring-1 ring-slate-700';
};

export function UpdateCenterCard() {
  const updaterService = useMemo(() => createUpdaterService(), []);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [updateError, setUpdateError] = useState('');
  const [installError, setInstallError] = useState('');
  const [installProgress, setInstallProgress] = useState<UpdateInstallProgress | null>(null);
  const [restartRequired, setRestartRequired] = useState(false);

  const runtimeInfoQuery = useQuery({
    queryKey: ['platform', 'release', 'updater'],
    queryFn: () => updaterService.getRuntimeInfo(),
  });

  const checkMutation = useMutation({
    mutationFn: () => updaterService.checkForUpdates(),
    onMutate: () => {
      setUpdateError('');
      setInstallError('');
      setRestartRequired(false);
    },
    onSuccess: (result) => {
      setUpdateResult(result);
      setInstallProgress(null);
    },
    onError: (error) => {
      setUpdateResult(null);
      setUpdateError(error instanceof Error ? error.message : 'Failed to check for updates.');
    },
  });

  const installMutation = useMutation({
    mutationFn: () =>
      updaterService.downloadAndInstall((progress) => {
        setInstallProgress(progress);
      }),
    onMutate: () => {
      setInstallError('');
      setRestartRequired(false);
      setInstallProgress({
        phase: 'started',
        downloadedBytes: 0,
        totalBytes: null,
      });
    },
    onSuccess: () => {
      setRestartRequired(true);
      setInstallProgress((current) =>
        current ?? {
          phase: 'finished',
          downloadedBytes: 0,
          totalBytes: null,
        },
      );
    },
    onError: (error) => {
      setInstallError(error instanceof Error ? error.message : 'Update installation failed.');
    },
  });

  const runtimeInfo = runtimeInfoQuery.data;
  const effectiveResult = updateResult
    ? updateResult
    : runtimeInfo
      ? {
          supportedRuntime: runtimeInfo.supportedRuntime,
          updaterConfigured: runtimeInfo.updaterConfigured,
          available: false,
          currentVersion: runtimeInfo.currentVersion,
          releaseChannel: runtimeInfo.releaseChannel,
          updaterEndpoint: runtimeInfo.updaterEndpoint,
          latestVersion: runtimeInfo.currentVersion,
          publishedAt: null,
          notes: runtimeInfo.notes,
          lastCheckedAt: null,
        }
      : null;

  const installPct =
    installProgress?.totalBytes && installProgress.totalBytes > 0
      ? Math.min(100, Math.round((installProgress.downloadedBytes / installProgress.totalBytes) * 100))
      : null;

  const updaterStatus: 'ok' | 'warn' | 'idle' = !effectiveResult
    ? 'idle'
    : !effectiveResult.supportedRuntime || !effectiveResult.updaterConfigured
      ? 'warn'
      : 'ok';

  return (
    <section className="kt-panel-elevated space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="kt-title-lg">App Updates</h3>
          <p className="mt-1 text-sm text-[color:var(--kt-text-secondary)]">
            Windows releases are published through GitHub Releases and installed through the Tauri updater.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${badgeClassForStatus(updaterStatus)}`}>
          {effectiveResult?.updaterConfigured ? 'Updater configured' : 'Updater unavailable'}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="kt-kv">
          <p className="kt-title-sm">Current Version</p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--kt-text-primary)]">
            {effectiveResult?.currentVersion ?? runtimeInfo?.currentVersion ?? 'loading'}
          </p>
        </div>
        <div className="kt-kv">
          <p className="kt-title-sm">Release Channel</p>
          <p className="mt-1 text-sm font-semibold capitalize text-[color:var(--kt-text-primary)]">
            {effectiveResult?.releaseChannel ?? runtimeInfo?.releaseChannel ?? 'unknown'}
          </p>
        </div>
        <div className="kt-kv">
          <p className="kt-title-sm">Last Checked</p>
          <p className="mt-1 text-sm text-[color:var(--kt-text-primary)]">
            {effectiveResult?.lastCheckedAt ? formatPlatformTs(Date.parse(effectiveResult.lastCheckedAt)) : 'not yet checked'}
          </p>
        </div>
        <div className="kt-kv">
          <p className="kt-title-sm">Feed Endpoint</p>
          <p className="mt-1 break-all text-xs text-[color:var(--kt-text-secondary)]">
            {effectiveResult?.updaterEndpoint ?? runtimeInfo?.updaterEndpoint ?? 'not configured'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="kt-btn kt-btn-secondary"
          disabled={checkMutation.isPending || installMutation.isPending}
          onClick={() => {
            void checkMutation.mutateAsync();
          }}
          type="button"
        >
          {checkMutation.isPending ? 'Checking...' : 'Check for Updates'}
        </button>
        <button
          className="kt-btn kt-btn-primary"
          disabled={!effectiveResult?.available || installMutation.isPending || checkMutation.isPending}
          onClick={() => {
            void installMutation.mutateAsync();
          }}
          type="button"
        >
          {installMutation.isPending ? 'Installing...' : 'Download and Install'}
        </button>
      </div>

      {effectiveResult ? (
        <div className="space-y-2 rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[color:var(--kt-text-primary)]">
              {effectiveResult.available
                ? `Update available: ${effectiveResult.latestVersion ?? 'new release'}`
                : effectiveResult.updaterConfigured
                  ? 'No update currently available'
                  : 'Updater is not active in this build'}
            </p>
            {effectiveResult.publishedAt ? (
              <p className="text-xs text-[color:var(--kt-text-secondary)]">
                Published {new Date(effectiveResult.publishedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
          <p className="text-sm text-[color:var(--kt-text-secondary)]">{effectiveResult.notes}</p>
          {effectiveResult.available && effectiveResult.notes ? (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-[color:var(--kt-text-secondary)]">
              {effectiveResult.notes}
            </pre>
          ) : null}
        </div>
      ) : null}

      {installProgress ? (
        <div className="space-y-2 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
          <p className="text-sm font-semibold text-blue-100">
            {installProgress.phase === 'finished' ? 'Update package installed.' : 'Downloading update package'}
          </p>
          <p className="text-xs text-blue-100/80">
            {installPct !== null
              ? `${installPct}% (${installProgress.downloadedBytes.toLocaleString()} / ${installProgress.totalBytes?.toLocaleString() ?? 'unknown'} bytes)`
              : `${installProgress.downloadedBytes.toLocaleString()} bytes downloaded`}
          </p>
          {installPct !== null ? (
            <div className="h-2 overflow-hidden rounded-full bg-slate-900/70">
              <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${installPct}%` }} />
            </div>
          ) : null}
        </div>
      ) : null}

      {restartRequired ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          Update installed. Restart Korda Tools to finish applying the new build.
        </div>
      ) : null}

      {updateError ? <p className="text-sm text-[color:var(--kt-danger)]">{updateError}</p> : null}
      {installError ? <p className="text-sm text-[color:var(--kt-danger)]">{installError}</p> : null}
    </section>
  );
}

