import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createNotificationService } from '../../../desktop/notifications/factory';
import { isTauriRuntime } from '../../../lib/runtime';
import { tauriEvent, tauriInvoke } from '../../../lib/tauri';
import type { SophonSource } from '../types';

export type IngestHealthProbe = {
  id: string;
  label: string;
  url: string;
  status: string;
  healthy: boolean;
  latencyMs?: number | null;
  message: string;
  details?: unknown;
};

export type IngestHealthSnapshot = {
  checkedAt: number;
  overallStatus: string;
  activeJobCount: number;
  probes: IngestHealthProbe[];
};

export type IngestJobSummary = {
  jobId: string;
  sourceId: string;
  sourceName: string;
  collectionName: string;
  status: string;
  currentStage: string;
  progressPct: number;
  createdAt: number;
  startedAt?: number | null;
  updatedAt: number;
  endedAt?: number | null;
  stageStartedAt?: number | null;
  lastHeartbeatAt?: number | null;
  workerId?: string | null;
  retryCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  detailMessage?: string | null;
  currentFileId?: string | null;
  currentFileName?: string | null;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  activeAlerts: number;
};

export type IngestFileRecord = {
  fileId: string;
  jobId: string;
  parentFileId?: string | null;
  sourcePath: string;
  stagedPath?: string | null;
  displayName: string;
  sizeBytes: number;
  mimeType?: string | null;
  pageCount?: number | null;
  pageRangeStart?: number | null;
  pageRangeEnd?: number | null;
  status: string;
  currentStage: string;
  progressPct: number;
  lastHeartbeatAt?: number | null;
  createdAt: number;
  updatedAt: number;
  checkpointJson?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type IngestStageRunRecord = {
  runId: string;
  jobId: string;
  fileId?: string | null;
  stage: string;
  status: string;
  progressPct: number;
  detailMessage?: string | null;
  startedAt: number;
  updatedAt: number;
  endedAt?: number | null;
  heartbeatAt?: number | null;
};

export type IngestEventRecord = {
  eventId: string;
  jobId: string;
  fileId?: string | null;
  level: string;
  kind: string;
  stage?: string | null;
  message: string;
  payloadJson?: unknown;
  createdAt: number;
};

export type IngestAlertRecord = {
  alertId: string;
  jobId?: string | null;
  fileId?: string | null;
  severity: string;
  kind: string;
  status: string;
  title: string;
  message: string;
  payloadJson?: unknown;
  createdAt: number;
  updatedAt: number;
  acknowledgedAt?: number | null;
};

export type IngestJobDetail = {
  job: IngestJobSummary;
  sourceSnapshot: unknown;
  options: unknown;
  checkpointJson?: unknown;
  files: IngestFileRecord[];
  stageRuns: IngestStageRunRecord[];
  events: IngestEventRecord[];
  alerts: IngestAlertRecord[];
};

export type IngestJobAction =
  | 'pause'
  | 'resume'
  | 'resume_job'
  | 'cancel'
  | 'retry_stage'
  | 'retry_file'
  | 'skip_file'
  | 'quarantine_file';

export async function ingestQueueSource(args: {
  source: SophonSource;
  options: { dryRun: boolean; safeMode: boolean; maxWorkers: number };
}): Promise<{ jobId: string; discoveredFiles: number; collectionName: string; status: string }> {
  if (!isTauriRuntime()) {
    throw new Error('Desktop ingestion queueing is only available in the Tauri runtime.');
  }
  return tauriInvoke('ingest_queue_source', {
    request: {
      source: {
        sourceId: args.source.id,
        sourceName: args.source.name,
        sourceType: args.source.sourceType,
        path: args.source.path,
        settings: {
          includePatterns: args.source.settings.includePatterns,
          excludePatterns: args.source.settings.excludePatterns,
          allowedExtensions: args.source.settings.allowedExtensions,
          maxFileSizeMb: args.source.settings.maxFileSizeMb,
          maxPages: args.source.settings.maxPages,
          watchEnabled: args.source.settings.watchEnabled,
          watchIntervalSec: args.source.settings.watchIntervalSec,
          debounceSeconds: args.source.settings.debounceSeconds,
          chunkSize: args.source.settings.chunkSize,
          chunkOverlap: args.source.settings.chunkOverlap,
          pageAwareChunking: args.source.settings.pageAwareChunking,
          ocrEnabled: args.source.settings.ocrEnabled,
          extractionEnabled: args.source.settings.extractionEnabled,
        },
      },
      options: args.options,
    },
  });
}

export async function ingestListJobs(): Promise<IngestJobSummary[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return tauriInvoke('ingest_list_jobs');
}

export async function ingestGetJob(jobId: string): Promise<IngestJobDetail> {
  if (!isTauriRuntime()) {
    throw new Error(`Desktop ingestion job detail is unavailable in web runtime for ${jobId}.`);
  }
  return tauriInvoke('ingest_get_job', { jobId });
}

export async function ingestJobAction(args: {
  jobId: string;
  action: IngestJobAction;
  fileId?: string;
}): Promise<IngestJobDetail> {
  if (!isTauriRuntime()) {
    throw new Error('Desktop ingestion actions are only available in the Tauri runtime.');
  }
  return tauriInvoke('ingest_job_action', {
    request: {
      jobId: args.jobId,
      action: args.action,
      fileId: args.fileId,
    },
  });
}

export async function ingestListAlerts(limit = 50): Promise<IngestAlertRecord[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return tauriInvoke('ingest_list_alerts', { limit });
}

export async function ingestAckAlert(alertId: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await tauriInvoke('ingest_ack_alert', { alertId });
}

export async function ingestGetHealthSnapshot(): Promise<IngestHealthSnapshot> {
  if (!isTauriRuntime()) {
    return {
      checkedAt: Date.now(),
      overallStatus: 'unknown',
      activeJobCount: 0,
      probes: [],
    };
  }
  return tauriInvoke('ingest_get_health_snapshot');
}

export function useSophonIngestLiveBridge(): void {
  const queryClient = useQueryClient();
  const lastAlertIdRef = useRef<string>('');

  useEffect(() => {
    if (!isTauriRuntime()) {
      return undefined;
    }

    let active = true;
    let unlisten: Array<() => void> = [];
    const notificationService = createNotificationService();

    const invalidate = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['sophon', 'ingest'] });
    };

    void (async () => {
      const eventApi = await tauriEvent();
      const listeners = await Promise.all([
        eventApi.listen<IngestJobSummary[]>('sophon://ingest/job', () => {
          invalidate();
        }),
        eventApi.listen<IngestFileRecord[]>('sophon://ingest/file', () => {
          invalidate();
        }),
        eventApi.listen<IngestHealthSnapshot>('sophon://ingest/health', () => {
          invalidate();
        }),
        eventApi.listen<IngestAlertRecord[]>('sophon://ingest/alert', (event) => {
          invalidate();
          const latestAlert = event.payload?.[0];
          if (!active || !latestAlert || latestAlert.status !== 'open') {
            return;
          }
          if (lastAlertIdRef.current === latestAlert.alertId) {
            return;
          }
          lastAlertIdRef.current = latestAlert.alertId;
          void notificationService.notify(latestAlert.title, latestAlert.message);
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

export const formatIngestTs = (value?: number | null): string => {
  if (!value) {
    return 'n/a';
  }
  return new Date(value).toLocaleString();
};
