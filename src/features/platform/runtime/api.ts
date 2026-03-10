import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createNotificationService } from '../../../desktop';
import { isTauriRuntime } from '../../../lib/runtime';
import { tauriEvent, tauriInvoke } from '../../../lib/tauri';

const STARTUP_QUERY_KEY = ['platform', 'startup'] as const;
const RELEASE_QUERY_KEY = ['platform', 'release'] as const;

export type AppReleaseInfo = {
  currentVersion: string;
  releaseChannel: string;
  updaterConfigured: boolean;
  updaterEndpoint?: string | null;
};

export type StartupStepStatus = {
  id: string;
  label: string;
  status: string;
  message: string;
  lastUpdatedAt: number;
  details?: unknown;
};

export type RuntimeReadinessCheck = {
  id: string;
  title: string;
  status: string;
  blocking: boolean;
  message: string;
  remediation: string[];
  details?: unknown;
};

export type RuntimeReadinessReport = {
  state: string;
  summary: string;
  blockerCount: number;
  warningCount: number;
  checks: RuntimeReadinessCheck[];
};

export type StartupStatusSnapshot = {
  overallStatus: string;
  message: string;
  lastUpdatedAt: number;
  lastAttemptedAt?: number | null;
  lastSuccessfulStartupAt?: number | null;
  startupAttemptCount: number;
  autoStartEnabled: boolean;
  appDataDir: string;
  appLogDir: string;
  diagnosticsDir: string;
  tempDir: string;
  latestDiagnosticsPath?: string | null;
  lastErrorSummary?: string | null;
  release: AppReleaseInfo;
  steps: StartupStepStatus[];
  runtimeReadiness?: RuntimeReadinessReport | null;
  ingestHealth?: {
    checkedAt: number;
    overallStatus: string;
    activeJobCount: number;
    probes: Array<{
      id: string;
      label: string;
      status: string;
      healthy: boolean;
      latencyMs?: number | null;
      message: string;
    }>;
  } | null;
};

export type DiagnosticsBundle = {
  path: string;
  createdAt: number;
};

export async function appGetReleaseInfo(): Promise<AppReleaseInfo> {
  if (!isTauriRuntime()) {
    return {
      currentVersion: 'web',
      releaseChannel: 'web',
      updaterConfigured: false,
      updaterEndpoint: null,
    };
  }
  return tauriInvoke<AppReleaseInfo>('app_get_release_info');
}

export async function appGetStartupStatus(): Promise<StartupStatusSnapshot> {
  if (!isTauriRuntime()) {
    return {
      overallStatus: 'ready',
      message: 'Web runtime does not manage desktop startup services.',
      lastUpdatedAt: Date.now(),
      lastAttemptedAt: null,
      lastSuccessfulStartupAt: null,
      startupAttemptCount: 0,
      autoStartEnabled: false,
      appDataDir: 'browser-storage',
      appLogDir: 'browser-console',
      diagnosticsDir: 'browser-console',
      tempDir: 'browser-cache',
      latestDiagnosticsPath: null,
      lastErrorSummary: null,
      release: await appGetReleaseInfo(),
      steps: [],
      runtimeReadiness: null,
      ingestHealth: null,
    };
  }
  return tauriInvoke<StartupStatusSnapshot>('app_get_startup_status');
}

export async function appRetryStartup(): Promise<StartupStatusSnapshot> {
  if (!isTauriRuntime()) {
    return appGetStartupStatus();
  }
  return tauriInvoke<StartupStatusSnapshot>('app_retry_startup');
}

export async function appCollectDiagnostics(): Promise<DiagnosticsBundle> {
  if (!isTauriRuntime()) {
    throw new Error('Diagnostics export is only available in the desktop runtime.');
  }
  return tauriInvoke<DiagnosticsBundle>('app_collect_diagnostics');
}

export function usePlatformLiveBridge(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isTauriRuntime()) {
      return undefined;
    }

    let active = true;
    let unlisten: Array<() => void> = [];
    const notificationService = createNotificationService();
    let lastNotificationKey = '';

    void (async () => {
      const eventApi = await tauriEvent();
      const listeners = await Promise.all([
        eventApi.listen<StartupStatusSnapshot>('korda://startup/status', (event) => {
          void queryClient.setQueryData(STARTUP_QUERY_KEY, event.payload);
          void queryClient.invalidateQueries({ queryKey: STARTUP_QUERY_KEY });
          void queryClient.invalidateQueries({ queryKey: RELEASE_QUERY_KEY });

          if (!active) {
            return;
          }

          const status = event.payload?.overallStatus ?? 'unknown';
          if (!['blocked', 'degraded'].includes(status)) {
            return;
          }

          const notificationKey = `${status}:${event.payload?.lastUpdatedAt ?? 0}`;
          if (notificationKey === lastNotificationKey) {
            return;
          }
          lastNotificationKey = notificationKey;
          void notificationService.notify(
            status === 'blocked' ? 'Korda Tools startup blocked' : 'Korda Tools startup degraded',
            event.payload?.message ?? 'Startup state changed.',
          );
        }),
      ]);

      if (!active) {
        listeners.forEach((listener) => {
          listener();
        });
        return;
      }
      unlisten = listeners;
    })();

    return () => {
      active = false;
      unlisten.forEach((listener) => {
        listener();
      });
    };
  }, [queryClient]);
}

export const formatPlatformTs = (value?: number | null): string => {
  if (!value) {
    return 'n/a';
  }
  return new Date(value).toLocaleString();
};

