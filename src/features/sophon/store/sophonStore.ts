import { create } from 'zustand';
import { createStorageEngine, hasAsyncLoad } from '../../../storage/createStorageEngine';
import { STORAGE_KEYS } from '../../../storage/keys';
import { assertSophonOfflinePolicy } from '../policy';
import { isSophonRuntimeBridgeEnabled, sophonRuntimeInvoke, sophonRuntimeState } from '../runtime/sophonRuntimeBridge';
import { sophonSchemaVersion, sophonStoreSchema } from '../schemas';
import type {
  SophonAuditEvent,
  SophonIngestionJob,
  SophonIngestionJobOptions,
  SophonIngestionStage,
  SophonLogEntry,
  SophonMetricsPoint,
  SophonRole,
  SophonSource,
  SophonSourceSettings,
  SophonSourceType,
  SophonSystemState,
  SophonTuningState,
} from '../types';

const STAGES: SophonIngestionStage[] = [
  'enumerate',
  'classify',
  'extract',
  'normalize',
  'chunk',
  'embed',
  'index',
  'validate',
  'publish',
];
const TICK_MS = 1200;
let timer: ReturnType<typeof setInterval> | null = null;

const id = (p: string) =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? `${p}-${crypto.randomUUID()}` : `${p}-${Date.now()}`;
const now = () => new Date().toISOString();
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.trunc(n)));
const stageIndex = (s: SophonIngestionStage) => STAGES.indexOf(s);
const nextStage = (s: SophonIngestionStage): SophonIngestionStage | null => {
  const i = stageIndex(s);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
};

const sourceDefaults: SophonSourceSettings = {
  includePatterns: ['**/*'],
  excludePatterns: ['**/~$*', '**/.tmp/**'],
  allowedExtensions: ['.pdf', '.docx', '.xlsx', '.csv', '.txt', '.md', '.dwg', '.dxf', '.ifc', '.jpg', '.png'],
  maxFileSizeMb: 1024,
  maxPages: 5000,
  watchEnabled: false,
  watchIntervalSec: 300,
  debounceSeconds: 20,
  dedupeStrategy: 'sha256',
  changeDetection: 'mtime_size_hash',
  retention: { derivedArtifactsDays: 180, snapshotRetentionDays: 365, keepFailedJobArtifactsDays: 30 },
  chunkSize: 1024,
  chunkOverlap: 150,
  pageAwareChunking: true,
  ocrEnabled: true,
  extractionEnabled: true,
};

const tuningDefaults: SophonTuningState = {
  embeddingModel: 'nvidia/llama-3.2-nv-embedqa-1b-v2',
  retrieverTopK: 20,
  rerankerEnabled: true,
  rerankerThreshold: 0.2,
  scoreThreshold: 0.15,
  contextWindowTokens: 32768,
  responseMaxTokens: 8192,
  explainRetrieval: false,
  maxIngestionWorkers: 4,
  forceCpuOnly: false,
};

const baseState: SophonSystemState = {
  version: sophonSchemaVersion,
  runtime: {
    transport: 'in_process',
    engineMode: 'embedded_nvidia',
    status: 'stopped',
    gpuAvailable: false,
    modelLoaded: false,
    vectorStoreReady: false,
    diskUsagePct: 0,
    queueDepth: 0,
    activeWorkers: 0,
  },
  role: 'admin',
  offlineOnlyEnforced: true,
  egressBlocked: true,
  blockedEgressAttempts: [],
  crossClientMixingPrevented: true,
  sources: [],
  jobs: [],
  index: {
    docCount: 0,
    chunkCount: 0,
    embeddingModel: tuningDefaults.embeddingModel,
    integrityStatus: 'unknown',
    revision: 1,
    snapshots: [],
  },
  tuning: tuningDefaults,
  metrics: [],
  logs: [],
  audit: [],
  activity: ['Sophon initialized in offline mode.'],
};

const persistence = createStorageEngine({
  key: STORAGE_KEYS.sophon,
  schema: sophonStoreSchema,
  defaultValue: { version: sophonSchemaVersion, state: baseState },
});

const appendAudit = (s: SophonSystemState, e: Omit<SophonAuditEvent, 'id' | 'eventTsUtc'>) =>
  [{ id: id('audit'), eventTsUtc: now(), ...e }, ...s.audit].slice(0, 10000);
const appendLog = (s: SophonSystemState, e: Omit<SophonLogEntry, 'id' | 'ts'>) =>
  [{ id: id('log'), ts: now(), ...e }, ...s.logs].slice(0, 15000);
const appendMetric = (s: SophonSystemState, e: Omit<SophonMetricsPoint, 'ts'>) =>
  [{ ts: now(), ...e }, ...s.metrics].slice(0, 10000);
const appendActivity = (s: SophonSystemState, m: string) => [`${now()} ${m}`, ...s.activity].slice(0, 2000);

const newJob = (source: SophonSource, options: SophonIngestionJobOptions, retries = 0): SophonIngestionJob => ({
  id: id('job'),
  sourceId: source.id,
  sourceName: source.name,
  status: 'queued',
  currentStage: 'enumerate',
  stages: STAGES.map((stage) => ({
    stage,
    status: 'queued',
    progressPct: 0,
    filesProcessed: 0,
    chunksProduced: 0,
    errorCount: 0,
  })),
  checkpoints: [],
  options,
  startedAt: now(),
  retries,
  discoveredFiles: 0,
  processedDocuments: 0,
  failedDocuments: 0,
  producedChunks: 0,
  blockedByPolicy: false,
  validation: {
    integrityPass: true,
    retrievalSanityPass: true,
    orphanedChunks: 0,
    missingMetadataRows: 0,
    warnings: [],
    errors: [],
  },
});

const loadState = (): SophonSystemState => {
  const parsed = sophonStoreSchema.safeParse(persistence.load());
  return parsed.success ? parsed.data.state : baseState;
};

type QueueInput = { sourceId: string; dryRun?: boolean; safeMode?: boolean; maxWorkers?: number };

type Store = {
  state: SophonSystemState;
  startRuntime: () => void;
  stopRuntime: () => void;
  runHealthCheck: () => void;
  pipelineTick: () => void;
  setRole: (role: SophonRole) => void;
  addSource: (input: {
    sourceType?: SophonSourceType;
    name: string;
    path: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    allowedExtensions?: string[];
    chunkSize?: number;
    chunkOverlap?: number;
    ocrEnabled?: boolean;
    extractionEnabled?: boolean;
    pageAwareChunking?: boolean;
    watchEnabled?: boolean;
    watchIntervalSec?: number;
    debounceSeconds?: number;
    maxFileSizeMb?: number;
    maxPages?: number;
    tags?: string[];
    sensitivity?: SophonSource['sensitivity'];
    clientBoundaryTag?: string;
    projectBoundaryTag?: string;
  }) => void;
  updateSource: (
    sourceId: string,
    patch: Partial<Pick<SophonSource, 'name' | 'path' | 'enabled' | 'tags' | 'sensitivity'>>,
  ) => void;
  removeSource: (sourceId: string) => void;
  queueIngestion: (input: QueueInput) => void;
  runIngestion: (sourceId: string) => void;
  pauseJob: (jobId: string) => void;
  resumeJob: (jobId: string) => void;
  cancelJob: (jobId: string) => void;
  retryJob: (jobId: string) => void;
  rebuildIndex: () => void;
  compactIndex: () => void;
  validateIndex: () => void;
  createSnapshot: (name: string) => void;
  restoreSnapshot: (snapshotId: string) => void;
  publishSnapshot: (snapshotId: string) => void;
  updateTuning: (input: Partial<SophonTuningState>) => void;
  runRetrievalTest: (query: string) => void;
  recordBlockedEgressAttempt: (target: string, reason: string) => void;
  setEgressBlocked: (blocked: boolean) => void;
  exportLogsBundle: () => string;
  exportBackupJson: () => string;
  importBackupJson: (json: string, dryRun: boolean) => { ok: boolean; message: string };
};

const persist = (s: SophonSystemState) => persistence.save({ version: sophonSchemaVersion, state: s });
const patch = (set: (f: (v: Store) => Store) => void, fn: (s: SophonSystemState) => SophonSystemState) =>
  set((prev) => {
    const next = fn(prev.state);
    persist(next);
    return { ...prev, state: next };
  });
const bridgeEnabled = (): boolean => isSophonRuntimeBridgeEnabled();
const replaceState = (set: (f: (v: Store) => Store) => void, state: SophonSystemState): void => {
  persist(state);
  set((prev) => ({ ...prev, state }));
};
const syncFromBridge = async (set: (f: (v: Store) => Store) => void): Promise<void> => {
  if (!bridgeEnabled()) {
    return;
  }
  try {
    const next = await sophonRuntimeState();
    replaceState(set, next);
  } catch (error) {
    console.error('Sophon runtime sync failed', error);
  }
};

export const useSophonStore = create<Store>((set, get) => ({
  state: loadState(),
  startRuntime: () => {
    if (bridgeEnabled()) {
      void (async () => {
        await sophonRuntimeInvoke('start_runtime');
        await syncFromBridge(set);
      })();
      if (!timer) timer = setInterval(() => void useSophonStore.getState().pipelineTick(), TICK_MS);
      return;
    }
    patch(set, (s) => {
      assertSophonOfflinePolicy({ offlineOnly: s.offlineOnlyEnforced, networkEgressEnabled: !s.egressBlocked, runtimeTransport: 'in_process' });
      const n: SophonSystemState = {
        ...s,
        runtime: {
          ...s.runtime,
          status: 'running',
          gpuAvailable: !s.tuning.forceCpuOnly,
          modelLoaded: true,
          vectorStoreReady: true,
          queueDepth: s.jobs.filter((j) => j.status === 'queued').length,
          lastHealthCheckAt: now(),
        },
      };
      n.activity = appendActivity(n, 'Runtime started.');
      n.logs = appendLog(n, { severity: 'info', source: 'runtime', message: 'Runtime started without HTTP listeners.' });
      n.audit = appendAudit(n, {
        actorId: 'local-admin',
        action: 'sophon.runtime.start',
        entityType: 'runtime',
        entityId: 'sophon',
        details: 'Runtime started in offline mode.',
        severity: 'info',
      });
      return n;
    });
    if (!timer) timer = setInterval(() => useSophonStore.getState().pipelineTick(), TICK_MS);
  },
  stopRuntime: () => {
    if (bridgeEnabled()) {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      void (async () => {
        await sophonRuntimeInvoke('stop_runtime');
        await syncFromBridge(set);
      })();
      return;
    }
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    patch(set, (s) => {
      const jobs = s.jobs.map((j) => (j.status === 'running' ? { ...j, status: 'paused' as const } : j));
      const n: SophonSystemState = {
        ...s,
        jobs,
        runtime: {
          ...s.runtime,
          status: 'stopped',
          modelLoaded: false,
          vectorStoreReady: false,
          activeWorkers: 0,
          queueDepth: jobs.filter((j) => j.status === 'queued').length,
          lastHealthCheckAt: now(),
        },
      };
      n.activity = appendActivity(n, 'Runtime stopped.');
      n.audit = appendAudit(n, { actorId: 'local-admin', action: 'sophon.runtime.stop', entityType: 'runtime', entityId: 'sophon', details: 'Runtime stopped.', severity: 'warn' });
      return n;
    });
  },
  runHealthCheck: () =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('run_health_check');
          await syncFromBridge(set);
        })()
      :
    patch(set, (s) => {
      const q = s.jobs.filter((j) => j.status === 'queued').length;
      const r = s.jobs.filter((j) => j.status === 'running').length;
      const f = s.jobs.filter((j) => j.status === 'failed').length;
      const n: SophonSystemState = {
        ...s,
        runtime: {
          ...s.runtime,
          queueDepth: q,
          activeWorkers: r,
          diskUsagePct: Math.min(97, Math.max(3, Math.round(s.index.chunkCount / 24))),
          lastHealthCheckAt: now(),
        },
      };
      n.metrics = appendMetric(n, { filesPerMinute: r * 12, chunksPerSecond: Number((r * 1.8).toFixed(2)), stageLatencyMsP95: r > 0 ? 1450 : 260, errorRatePct: Number(((f / Math.max(1, s.jobs.length)) * 100).toFixed(2)) });
      n.activity = appendActivity(n, 'Health check completed.');
      return n;
    }),
  pipelineTick: () =>
    bridgeEnabled()
      ? void syncFromBridge(set)
      :
    patch(set, (s) => {
      if (s.runtime.status !== 'running') return s;
      const nowTs = now();
      const jobs = s.jobs.map((j) => ({ ...j, stages: j.stages.map((st) => ({ ...st })), checkpoints: j.checkpoints.map((c) => ({ ...c })), validation: { ...j.validation, warnings: [...j.validation.warnings], errors: [...j.validation.errors] } }));
      const sources = s.sources.map((x) => ({ ...x, settings: { ...x.settings } }));
      const cap = s.tuning.forceCpuOnly ? 1 : clamp(s.tuning.maxIngestionWorkers, 1, 128);
      let running = jobs.filter((j) => j.status === 'running').length;
      for (const job of jobs.filter((j) => j.status === 'queued')) {
        if (running >= cap) break;
        job.status = 'running';
        const st = job.stages[stageIndex(job.currentStage)];
        st.status = 'running';
        st.startedAt = st.startedAt ?? nowTs;
        running += 1;
      }
      let completed = 0;
      for (const job of jobs) {
        if (job.status !== 'running') continue;
        const source = sources.find((x) => x.id === job.sourceId);
        if (!source || !source.enabled) {
          job.status = 'failed';
          job.endedAt = nowTs;
          job.failureReason = 'Source missing or disabled.';
          continue;
        }
        if (source.path.startsWith('http://') || source.path.startsWith('https://')) {
          job.status = 'failed';
          job.endedAt = nowTs;
          job.blockedByPolicy = true;
          job.failureReason = 'Blocked by offline-only policy.';
          job.validation.integrityPass = false;
          job.validation.errors.push('SOPHON_EGRESS_BLOCK_REQUIRED');
          continue;
        }
        const st = job.stages[stageIndex(job.currentStage)];
        st.status = 'running';
        st.progressPct = clamp(st.progressPct + (job.options.safeMode ? 12 : 28), 0, 100);
        if (job.currentStage === 'enumerate') {
          job.discoveredFiles = Math.max(job.discoveredFiles, 6 + source.settings.includePatterns.length * 2);
          st.filesProcessed = job.discoveredFiles;
        }
        if (job.currentStage === 'chunk') st.chunksProduced = Math.max(st.chunksProduced, Math.max(1, Math.floor(source.settings.chunkSize / 160)) * Math.max(1, job.discoveredFiles));
        if (st.progressPct < 100) continue;
        st.status = 'completed';
        st.endedAt = nowTs;
        st.latencyMs = Math.max(120, (stageIndex(job.currentStage) + 1) * 420);
        job.checkpoints.push({ stage: job.currentStage, cursor: `done:${job.currentStage}`, persistedAt: nowTs });
        const nxt = nextStage(job.currentStage);
        if (!nxt) {
          job.status = 'completed';
          job.endedAt = nowTs;
          job.processedDocuments = job.discoveredFiles;
          job.producedChunks = job.stages.reduce((a, b) => a + b.chunksProduced, 0);
          source.lastIngestedAt = nowTs;
          completed += 1;
          continue;
        }
        job.currentStage = nxt;
        const nextMetric = job.stages[stageIndex(nxt)];
        nextMetric.status = 'running';
        nextMetric.startedAt = nextMetric.startedAt ?? nowTs;
      }
      const doneJobs = jobs.filter((j) => j.status === 'completed' && !j.options.dryRun && j.endedAt === nowTs);
      const docAdd = doneJobs.reduce((a, b) => a + b.processedDocuments, 0);
      const chunkAdd = doneJobs.reduce((a, b) => a + b.producedChunks, 0);
      const updatedIndex: SophonSystemState['index'] =
        completed > 0
          ? {
              ...s.index,
              docCount: s.index.docCount + docAdd,
              chunkCount: s.index.chunkCount + chunkAdd,
              embeddingModel: s.tuning.embeddingModel,
              integrityStatus: 'healthy',
              revision: s.index.revision + completed,
              lastUpdatedAt: nowTs,
            }
          : s.index;
      const n: SophonSystemState = {
        ...s,
        sources,
        jobs,
        index: updatedIndex,
        runtime: {
          ...s.runtime,
          queueDepth: jobs.filter((j) => j.status === 'queued').length,
          activeWorkers: jobs.filter((j) => j.status === 'running').length,
        },
      };
      if (completed > 0) {
        n.activity = appendActivity(n, `${completed} ingestion job(s) completed.`);
        n.logs = appendLog(n, { severity: 'info', source: 'ingestion', message: `${completed} job(s) completed.` });
      }
      return n;
    }),
  setRole: (role) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('set_role', { role });
          await syncFromBridge(set);
        })()
      : patch(set, (s) => ({ ...s, role })),
  addSource: (input) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('add_source', input as Record<string, unknown>);
          await syncFromBridge(set);
        })()
      :
    patch(set, (s) => {
      const created = now();
      const src: SophonSource = {
        id: id('source'),
        sourceType: input.sourceType ?? 'folder',
        name: input.name.trim(),
        path: input.path.trim(),
        enabled: true,
        settings: {
          ...sourceDefaults,
          includePatterns: input.includePatterns?.length ? input.includePatterns : sourceDefaults.includePatterns,
          excludePatterns: input.excludePatterns?.length ? input.excludePatterns : sourceDefaults.excludePatterns,
          allowedExtensions: input.allowedExtensions?.length ? input.allowedExtensions : sourceDefaults.allowedExtensions,
          chunkSize: input.chunkSize ?? sourceDefaults.chunkSize,
          chunkOverlap: input.chunkOverlap ?? sourceDefaults.chunkOverlap,
          ocrEnabled: input.ocrEnabled ?? sourceDefaults.ocrEnabled,
          extractionEnabled: input.extractionEnabled ?? sourceDefaults.extractionEnabled,
          pageAwareChunking: input.pageAwareChunking ?? sourceDefaults.pageAwareChunking,
          watchEnabled: input.watchEnabled ?? sourceDefaults.watchEnabled,
          watchIntervalSec: input.watchIntervalSec ?? sourceDefaults.watchIntervalSec,
          debounceSeconds: input.debounceSeconds ?? sourceDefaults.debounceSeconds,
          maxFileSizeMb: input.maxFileSizeMb ?? sourceDefaults.maxFileSizeMb,
          maxPages: input.maxPages ?? sourceDefaults.maxPages,
        },
        tags: input.tags ?? ['sophon'],
        sensitivity: input.sensitivity ?? 'Internal',
        clientBoundaryTag: input.clientBoundaryTag?.trim() || undefined,
        projectBoundaryTag: input.projectBoundaryTag?.trim() || undefined,
        createdAt: created,
        updatedAt: created,
      };
      const n: SophonSystemState = { ...s, sources: [src, ...s.sources] };
      n.activity = appendActivity(n, `Source added: ${src.name}.`);
      n.audit = appendAudit(n, { actorId: 'local-admin', action: 'sophon.sources.add', entityType: 'source', entityId: src.id, details: `Added source "${src.name}"`, severity: 'info' });
      return n;
    }),
  updateSource: (sourceId, patchData) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('update_source', {
            sourceId,
            patch: patchData,
          });
          await syncFromBridge(set);
        })()
      : patch(set, (s) => ({ ...s, sources: s.sources.map((x) => (x.id === sourceId ? { ...x, ...patchData, updatedAt: now() } : x)) })),
  removeSource: (sourceId) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('remove_source', { sourceId });
          await syncFromBridge(set);
        })()
      : patch(set, (s) => ({ ...s, sources: s.sources.filter((x) => x.id !== sourceId) })),
  queueIngestion: ({ sourceId, dryRun = false, safeMode = false, maxWorkers }) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('queue_ingestion', {
            sourceId,
            dryRun,
            safeMode,
            maxWorkers,
          });
          await syncFromBridge(set);
        })()
      :
    patch(set, (s) => {
      const source = s.sources.find((x) => x.id === sourceId);
      if (!source) return s;
      assertSophonOfflinePolicy({ offlineOnly: s.offlineOnlyEnforced, networkEgressEnabled: !s.egressBlocked, runtimeTransport: 'in_process' });
      const job = newJob(source, { dryRun, safeMode, maxWorkers: clamp(maxWorkers ?? s.tuning.maxIngestionWorkers, 1, 128) });
      const n: SophonSystemState = {
        ...s,
        jobs: [job, ...s.jobs].slice(0, 5000),
        runtime: { ...s.runtime, queueDepth: s.runtime.queueDepth + 1 },
      };
      n.activity = appendActivity(n, `Ingestion queued for source ${source.name}.`);
      return n;
    }),
  runIngestion: (sourceId) => get().queueIngestion({ sourceId }),
  pauseJob: (jobId) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('pause_job', { jobId });
          await syncFromBridge(set);
        })()
      : patch(set, (s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === jobId && j.status === 'running' ? { ...j, status: 'paused' } : j)) })),
  resumeJob: (jobId) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('resume_job', { jobId });
          await syncFromBridge(set);
        })()
      : patch(set, (s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === jobId && j.status === 'paused' ? { ...j, status: 'queued' } : j)) })),
  cancelJob: (jobId) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('cancel_job', { jobId });
          await syncFromBridge(set);
        })()
      : patch(set, (s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === jobId && !['completed', 'failed', 'cancelled'].includes(j.status) ? { ...j, status: 'cancelled', endedAt: now(), failureReason: j.failureReason ?? 'Cancelled by operator.' } : j)) })),
  retryJob: (jobId) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('retry_job', { jobId });
          await syncFromBridge(set);
        })()
      :
    patch(set, (s) => {
      const original = s.jobs.find((j) => j.id === jobId);
      const source = original ? s.sources.find((x) => x.id === original.sourceId) : undefined;
      if (!original || !source) return s;
      return { ...s, jobs: [newJob(source, original.options, original.retries + 1), ...s.jobs].slice(0, 5000) };
    }),
  rebuildIndex: () =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('rebuild_index');
          await syncFromBridge(set);
        })()
      :
    patch(set, (s) => ({
      ...s,
      index: { ...s.index, revision: s.index.revision + 1, integrityStatus: 'healthy', lastUpdatedAt: now() },
    })),
  compactIndex: () =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('compact_index');
          await syncFromBridge(set);
        })()
      : patch(set, (s) => ({ ...s, index: { ...s.index, chunkCount: Math.max(0, s.index.chunkCount - Math.floor(s.index.chunkCount * 0.08)), revision: s.index.revision + 1, lastUpdatedAt: now() } })),
  validateIndex: () =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('validate_index');
          await syncFromBridge(set);
        })()
      :
    patch(set, (s) => ({
      ...s,
      index: {
        ...s.index,
        integrityStatus: s.jobs.some((j) => j.status === 'failed') ? 'degraded' : 'healthy',
        lastValidatedAt: now(),
      },
    })),
  createSnapshot: (name) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('create_snapshot', { name });
          await syncFromBridge(set);
        })()
      :
    patch(set, (s) => ({
      ...s,
      index: {
        ...s.index,
        activeSnapshotId: s.index.activeSnapshotId ?? id('snapshot'),
        snapshots: [{ id: id('snapshot'), name: name.trim() || `snapshot-${new Date().toISOString().slice(0, 10)}`, createdAt: now(), docCount: s.index.docCount, chunkCount: s.index.chunkCount, embeddingModel: s.index.embeddingModel }, ...s.index.snapshots].slice(0, 200),
      },
    })),
  restoreSnapshot: (snapshotId) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('restore_snapshot', { snapshotId });
          await syncFromBridge(set);
        })()
      :
    patch(set, (s) => {
      const snap = s.index.snapshots.find((x) => x.id === snapshotId);
      if (!snap) return s;
      return { ...s, index: { ...s.index, docCount: snap.docCount, chunkCount: snap.chunkCount, embeddingModel: snap.embeddingModel, activeSnapshotId: snap.id, revision: s.index.revision + 1, lastUpdatedAt: now() } };
    }),
  publishSnapshot: (snapshotId) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('publish_snapshot', { snapshotId });
          await syncFromBridge(set);
        })()
      : patch(set, (s) => ({ ...s, index: { ...s.index, activeSnapshotId: snapshotId, lastUpdatedAt: now() } })),
  updateTuning: (input) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('update_tuning', { input });
          await syncFromBridge(set);
        })()
      : patch(set, (s) => ({ ...s, tuning: { ...s.tuning, ...input, maxIngestionWorkers: clamp(input.maxIngestionWorkers ?? s.tuning.maxIngestionWorkers, 1, 128) }, index: { ...s.index, embeddingModel: input.embeddingModel ?? s.index.embeddingModel } })),
  runRetrievalTest: (query) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('run_retrieval_test', { query });
          await syncFromBridge(set);
        })()
      :
    patch(set, (s) => {
      const q = query.trim();
      if (!q) return s;
      if (q.includes('http://') || q.includes('https://')) {
        const e = { id: id('egress'), attemptedTarget: q, reason: 'SOPHON_EGRESS_BLOCK_REQUIRED', blockedAt: now() };
        return { ...s, blockedEgressAttempts: [e, ...s.blockedEgressAttempts].slice(0, 2000) };
      }
      const passages = s.sources
        .filter((x) => x.enabled)
        .slice(0, Math.max(1, Math.min(s.tuning.retrieverTopK, 8)))
        .map((x, i) => ({ sourceName: x.name, score: Math.max(0.08, Number((1 - i * 0.11).toFixed(2))), content: `Source=${x.path}; patterns=${x.settings.includePatterns.join(',')}; chunk=${x.settings.chunkSize}/${x.settings.chunkOverlap}; sensitivity=${x.sensitivity}` }));
      return {
        ...s,
        lastRetrieval: { query: q, answer: passages.length > 0 ? `Sophon retrieved ${passages.length} grounded passage(s) for "${q}".` : `No indexed passages for "${q}". Queue ingestion first.`, passages, generatedAt: now() },
      };
    }),
  recordBlockedEgressAttempt: (target, reason) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('record_blocked_egress_attempt', { target, reason });
          await syncFromBridge(set);
        })()
      : patch(set, (s) => ({ ...s, blockedEgressAttempts: [{ id: id('egress'), attemptedTarget: target, reason, blockedAt: now() }, ...s.blockedEgressAttempts].slice(0, 2000) })),
  setEgressBlocked: (blocked) =>
    bridgeEnabled()
      ? void (async () => {
          await sophonRuntimeInvoke('set_egress_blocked', { blocked });
          await syncFromBridge(set);
        })()
      : patch(set, (s) => ({ ...s, egressBlocked: blocked })),
  exportLogsBundle: () => get().state.logs.map((x) => JSON.stringify(x)).join('\n'),
  exportBackupJson: () => JSON.stringify({ exportedAt: now(), module: 'Sophon', version: sophonSchemaVersion, state: get().state }, null, 2),
  importBackupJson: (json, dryRun) => {
    if (bridgeEnabled()) {
      void (async () => {
        await sophonRuntimeInvoke('import_backup_json', { json, dryRun });
        await syncFromBridge(set);
      })();
      return { ok: true, message: dryRun ? 'Dry-run validation submitted.' : 'Restore submitted to Sophon runtime.' };
    }
    try {
      const payload = JSON.parse(json) as { state?: unknown };
      const parsed = sophonStoreSchema.safeParse({ version: sophonSchemaVersion, state: payload.state });
      if (!parsed.success) return { ok: false, message: 'Backup payload failed schema validation.' };
      if (dryRun) return { ok: true, message: 'Dry-run validation passed.' };
      patch(set, () => parsed.data.state);
      return { ok: true, message: 'Backup restored successfully.' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Backup restore failed.' };
    }
  },
}));

if (hasAsyncLoad(persistence)) {
  void persistence.loadAsync().then((v) => {
    const parsed = sophonStoreSchema.safeParse(v);
    if (parsed.success) useSophonStore.setState({ state: parsed.data.state });
  });
}

if (bridgeEnabled()) {
  const bridgeSet = (updater: (value: Store) => Store): void => {
    useSophonStore.setState(updater);
  };
  void syncFromBridge(bridgeSet);
  if (!timer) timer = setInterval(() => void useSophonStore.getState().pipelineTick(), TICK_MS);
}
