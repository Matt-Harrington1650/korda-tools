import { create } from 'zustand';
import { createStorageEngine, hasAsyncLoad } from '../../../storage/createStorageEngine';
import { STORAGE_KEYS } from '../../../storage/keys';
import { assertSophonOfflinePolicy } from '../policy';
import { sophonSchemaVersion, sophonStoreSchema } from '../schemas';
import type {
  SophonAuditEvent,
  SophonIngestionJob,
  SophonRole,
  SophonSource,
  SophonSystemState,
  SophonTuningState,
} from '../types';

const createId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const nowIso = (): string => new Date().toISOString();

const defaultTuning: SophonTuningState = {
  embeddingModel: 'nvidia/llama-3.2-nv-embedqa-1b-v2',
  retrieverTopK: 20,
  rerankerEnabled: true,
  rerankerThreshold: 0.2,
  scoreThreshold: 0.15,
  contextWindowTokens: 32768,
  responseMaxTokens: 8192,
  explainRetrieval: false,
};

const defaultState: SophonSystemState = {
  version: sophonSchemaVersion,
  runtime: {
    status: 'stopped',
    gpuAvailable: false,
    modelLoaded: false,
    vectorStoreReady: false,
    diskUsagePct: 0,
    queueDepth: 0,
  },
  role: 'admin',
  offlineOnlyEnforced: true,
  egressBlocked: true,
  sources: [],
  jobs: [],
  index: {
    docCount: 0,
    chunkCount: 0,
    embeddingModel: defaultTuning.embeddingModel,
    revision: 1,
    snapshots: [],
  },
  tuning: defaultTuning,
  audit: [],
  activity: ['Sophon initialized in offline mode.'],
};

const persistence = createStorageEngine({
  key: STORAGE_KEYS.sophon,
  schema: sophonStoreSchema,
  defaultValue: {
    version: sophonSchemaVersion,
    state: defaultState,
  },
});

const persistState = (state: SophonSystemState): void => {
  persistence.save({
    version: sophonSchemaVersion,
    state,
  });
};

const appendAudit = (
  state: SophonSystemState,
  input: Omit<SophonAuditEvent, 'id' | 'eventTsUtc'>,
): SophonAuditEvent[] => {
  const event: SophonAuditEvent = {
    id: createId('audit'),
    eventTsUtc: nowIso(),
    ...input,
  };
  return [event, ...state.audit].slice(0, 1000);
};

const appendActivity = (state: SophonSystemState, message: string): string[] => {
  return [`${nowIso()} ${message}`, ...state.activity].slice(0, 500);
};

const parseLoadedState = (): SophonSystemState => {
  const loaded = persistence.load();
  const parsed = sophonStoreSchema.safeParse(loaded);
  if (!parsed.success) {
    return defaultState;
  }
  return parsed.data.state;
};

const updateState = (
  set: (updater: (state: SophonStoreState) => SophonStoreState) => void,
  updater: (state: SophonSystemState) => SophonSystemState,
): void => {
  set((prev) => {
    const nextState = updater(prev.state);
    persistState(nextState);
    return {
      ...prev,
      state: nextState,
    };
  });
};

type SophonStoreState = {
  state: SophonSystemState;
  startRuntime: () => void;
  stopRuntime: () => void;
  runHealthCheck: () => void;
  setRole: (role: SophonRole) => void;
  addSource: (input: {
    name: string;
    path: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    chunkSize?: number;
    chunkOverlap?: number;
    ocrEnabled?: boolean;
    extractionEnabled?: boolean;
    tags?: string[];
    sensitivity?: SophonSource['sensitivity'];
  }) => void;
  removeSource: (sourceId: string) => void;
  runIngestion: (sourceId: string) => void;
  retryJob: (jobId: string) => void;
  rebuildIndex: () => void;
  compactIndex: () => void;
  createSnapshot: (name: string) => void;
  restoreSnapshot: (snapshotId: string) => void;
  updateTuning: (input: Partial<SophonTuningState>) => void;
  runRetrievalTest: (query: string) => void;
  exportBackupJson: () => string;
  importBackupJson: (json: string, dryRun: boolean) => { ok: boolean; message: string };
};

export const useSophonStore = create<SophonStoreState>((set, get) => ({
  state: parseLoadedState(),
  startRuntime: () => {
    updateState(set, (state) => {
      assertSophonOfflinePolicy({
        offlineOnly: state.offlineOnlyEnforced,
        networkEgressEnabled: !state.egressBlocked,
        runtimeTransport: 'in_process',
      });

      const next: SophonSystemState = {
        ...state,
        runtime: {
          ...state.runtime,
          status: 'running',
          gpuAvailable: true,
          modelLoaded: true,
          vectorStoreReady: true,
          lastHealthCheckAt: nowIso(),
        },
      };
      next.activity = appendActivity(next, 'Runtime started.');
      next.audit = appendAudit(next, {
        actorId: 'local-admin',
        action: 'sophon.runtime.start',
        entityType: 'runtime',
        entityId: 'sophon',
        details: 'Runtime started in-process with offline policy enforced.',
        severity: 'info',
      });
      return next;
    });
  },
  stopRuntime: () => {
    updateState(set, (state) => {
      const next: SophonSystemState = {
        ...state,
        runtime: {
          ...state.runtime,
          status: 'stopped',
          modelLoaded: false,
          vectorStoreReady: false,
          queueDepth: 0,
          lastHealthCheckAt: nowIso(),
        },
      };
      next.activity = appendActivity(next, 'Runtime stopped.');
      next.audit = appendAudit(next, {
        actorId: 'local-admin',
        action: 'sophon.runtime.stop',
        entityType: 'runtime',
        entityId: 'sophon',
        details: 'Runtime stopped.',
        severity: 'warn',
      });
      return next;
    });
  },
  runHealthCheck: () => {
    updateState(set, (state) => {
      const hasSources = state.sources.some((item) => item.enabled);
      const hasJobsRunning = state.jobs.some((item) => item.status === 'running' || item.status === 'queued');
      const next: SophonSystemState = {
        ...state,
        runtime: {
          ...state.runtime,
          status: state.runtime.status === 'stopped' ? 'stopped' : 'running',
          queueDepth: hasJobsRunning ? Math.max(1, state.runtime.queueDepth) : 0,
          diskUsagePct: Math.min(95, Math.max(5, Math.round(state.index.chunkCount / 10))),
          vectorStoreReady: state.runtime.status !== 'stopped' && hasSources,
          lastHealthCheckAt: nowIso(),
        },
      };
      next.activity = appendActivity(next, 'Health check completed.');
      return next;
    });
  },
  setRole: (role) => {
    updateState(set, (state) => {
      const next: SophonSystemState = {
        ...state,
        role,
      };
      next.activity = appendActivity(next, `Role switched to ${role}.`);
      next.audit = appendAudit(next, {
        actorId: 'local-admin',
        action: 'sophon.rbac.set_role',
        entityType: 'rbac',
        entityId: role,
        details: `Active Sophon role set to ${role}.`,
        severity: 'info',
      });
      return next;
    });
  },
  addSource: (input) => {
    updateState(set, (state) => {
      const now = nowIso();
      const source: SophonSource = {
        id: createId('source'),
        name: input.name.trim(),
        path: input.path.trim(),
        enabled: true,
        includePatterns: input.includePatterns?.length ? input.includePatterns : ['**/*'],
        excludePatterns: input.excludePatterns ?? [],
        chunkSize: input.chunkSize ?? 1024,
        chunkOverlap: input.chunkOverlap ?? 150,
        ocrEnabled: input.ocrEnabled ?? true,
        extractionEnabled: input.extractionEnabled ?? true,
        tags: input.tags ?? [],
        sensitivity: input.sensitivity ?? 'Internal',
        createdAt: now,
        updatedAt: now,
      };

      const next: SophonSystemState = {
        ...state,
        sources: [source, ...state.sources],
      };
      next.activity = appendActivity(next, `Source added: ${source.name}.`);
      next.audit = appendAudit(next, {
        actorId: 'local-admin',
        action: 'sophon.sources.add',
        entityType: 'source',
        entityId: source.id,
        details: `Added source "${source.name}" at ${source.path}.`,
        severity: 'info',
      });
      return next;
    });
  },
  removeSource: (sourceId) => {
    updateState(set, (state) => {
      const source = state.sources.find((item) => item.id === sourceId);
      const next: SophonSystemState = {
        ...state,
        sources: state.sources.filter((item) => item.id !== sourceId),
      };
      next.activity = appendActivity(next, `Source removed: ${source?.name ?? sourceId}.`);
      next.audit = appendAudit(next, {
        actorId: 'local-admin',
        action: 'sophon.sources.remove',
        entityType: 'source',
        entityId: sourceId,
        details: `Removed source ${source?.name ?? sourceId}.`,
        severity: 'warn',
      });
      return next;
    });
  },
  runIngestion: (sourceId) => {
    updateState(set, (state) => {
      const source = state.sources.find((item) => item.id === sourceId);
      if (!source) {
        return state;
      }

      const startedAt = nowIso();
      const producedDocs = Math.max(1, source.includePatterns.length);
      const producedChunks = Math.max(2, Math.floor(source.chunkSize / 128));
      const job: SophonIngestionJob = {
        id: createId('job'),
        sourceId: source.id,
        sourceName: source.name,
        status: 'completed',
        startedAt,
        endedAt: nowIso(),
        retries: 0,
        processedDocuments: producedDocs,
        failedDocuments: 0,
      };

      const next: SophonSystemState = {
        ...state,
        runtime: {
          ...state.runtime,
          queueDepth: 0,
        },
        jobs: [job, ...state.jobs].slice(0, 500),
        index: {
          ...state.index,
          docCount: state.index.docCount + producedDocs,
          chunkCount: state.index.chunkCount + producedChunks,
          embeddingModel: state.tuning.embeddingModel,
          lastUpdatedAt: nowIso(),
          revision: state.index.revision + 1,
        },
      };
      next.activity = appendActivity(next, `Ingestion completed for source ${source.name}.`);
      next.audit = appendAudit(next, {
        actorId: 'local-operator',
        action: 'sophon.ingestion.run',
        entityType: 'job',
        entityId: job.id,
        details: `Ingested ${producedDocs} documents from ${source.name}.`,
        severity: 'info',
      });
      return next;
    });
  },
  retryJob: (jobId) => {
    const state = get().state;
    const target = state.jobs.find((job) => job.id === jobId);
    if (!target) {
      return;
    }
    get().runIngestion(target.sourceId);
  },
  rebuildIndex: () => {
    updateState(set, (state) => {
      const next: SophonSystemState = {
        ...state,
        index: {
          ...state.index,
          revision: state.index.revision + 1,
          lastUpdatedAt: nowIso(),
        },
      };
      next.activity = appendActivity(next, 'Index rebuild completed.');
      next.audit = appendAudit(next, {
        actorId: 'local-operator',
        action: 'sophon.index.rebuild',
        entityType: 'index',
        entityId: 'primary',
        details: 'Index rebuild completed.',
        severity: 'info',
      });
      return next;
    });
  },
  compactIndex: () => {
    updateState(set, (state) => {
      const compactedChunks = Math.max(0, state.index.chunkCount - Math.floor(state.index.chunkCount * 0.05));
      const next: SophonSystemState = {
        ...state,
        index: {
          ...state.index,
          chunkCount: compactedChunks,
          lastUpdatedAt: nowIso(),
          revision: state.index.revision + 1,
        },
      };
      next.activity = appendActivity(next, 'Index compaction completed.');
      next.audit = appendAudit(next, {
        actorId: 'local-operator',
        action: 'sophon.index.compact',
        entityType: 'index',
        entityId: 'primary',
        details: 'Index compacted to reduce storage footprint.',
        severity: 'info',
      });
      return next;
    });
  },
  createSnapshot: (name) => {
    updateState(set, (state) => {
      const snapshot = {
        id: createId('snapshot'),
        name: name.trim() || `snapshot-${new Date().toISOString().slice(0, 10)}`,
        createdAt: nowIso(),
        docCount: state.index.docCount,
        chunkCount: state.index.chunkCount,
        embeddingModel: state.index.embeddingModel,
      };
      const next: SophonSystemState = {
        ...state,
        index: {
          ...state.index,
          snapshots: [snapshot, ...state.index.snapshots].slice(0, 50),
        },
      };
      next.activity = appendActivity(next, `Snapshot created: ${snapshot.name}.`);
      next.audit = appendAudit(next, {
        actorId: 'local-admin',
        action: 'sophon.index.snapshot',
        entityType: 'snapshot',
        entityId: snapshot.id,
        details: `Snapshot "${snapshot.name}" created.`,
        severity: 'info',
      });
      return next;
    });
  },
  restoreSnapshot: (snapshotId) => {
    updateState(set, (state) => {
      const snapshot = state.index.snapshots.find((item) => item.id === snapshotId);
      if (!snapshot) {
        return state;
      }

      const next: SophonSystemState = {
        ...state,
        index: {
          ...state.index,
          docCount: snapshot.docCount,
          chunkCount: snapshot.chunkCount,
          embeddingModel: snapshot.embeddingModel,
          lastUpdatedAt: nowIso(),
          revision: state.index.revision + 1,
        },
      };
      next.activity = appendActivity(next, `Snapshot restored: ${snapshot.name}.`);
      next.audit = appendAudit(next, {
        actorId: 'local-admin',
        action: 'sophon.index.restore',
        entityType: 'snapshot',
        entityId: snapshot.id,
        details: `Restored snapshot "${snapshot.name}".`,
        severity: 'warn',
      });
      return next;
    });
  },
  updateTuning: (input) => {
    updateState(set, (state) => {
      const next: SophonSystemState = {
        ...state,
        tuning: {
          ...state.tuning,
          ...input,
        },
        index: {
          ...state.index,
          embeddingModel: input.embeddingModel ?? state.index.embeddingModel,
        },
      };
      next.activity = appendActivity(next, 'Model/tuning configuration updated.');
      next.audit = appendAudit(next, {
        actorId: 'local-admin',
        action: 'sophon.tuning.update',
        entityType: 'tuning',
        entityId: 'global',
        details: 'Retriever/model tuning values updated.',
        severity: 'info',
      });
      return next;
    });
  },
  runRetrievalTest: (query) => {
    updateState(set, (state) => {
      const clean = query.trim();
      if (!clean) {
        return state;
      }
      const samplePassages = state.sources.slice(0, 3).map((source, index) => {
        const score = Math.max(0.05, Number((1 - index * 0.18).toFixed(2)));
        return {
          sourceName: source.name,
          score,
          content: `Retrieved from ${source.path} with include patterns: ${source.includePatterns.join(', ')}`,
        };
      });

      const answer =
        samplePassages.length > 0
          ? `Sophon found ${samplePassages.length} grounded passages relevant to "${clean}".`
          : `Sophon found no indexed passages for "${clean}". Ingest sources first.`;

      const next: SophonSystemState = {
        ...state,
        lastRetrieval: {
          query: clean,
          answer,
          passages: samplePassages,
          generatedAt: nowIso(),
        },
      };
      next.activity = appendActivity(next, `Retrieval test executed for query: ${clean}`);
      next.audit = appendAudit(next, {
        actorId: 'local-operator',
        action: 'sophon.retrieval.test',
        entityType: 'retrieval',
        entityId: 'lab',
        details: `Retrieval lab query executed (${samplePassages.length} passages).`,
        severity: 'info',
      });
      return next;
    });
  },
  exportBackupJson: () => {
    const state = get().state;
    return JSON.stringify(
      {
        exportedAt: nowIso(),
        module: 'Sophon',
        version: sophonSchemaVersion,
        state,
      },
      null,
      2,
    );
  },
  importBackupJson: (json, dryRun) => {
    try {
      const parsed = JSON.parse(json) as { state?: unknown };
      const candidate = sophonStoreSchema.safeParse({
        version: sophonSchemaVersion,
        state: parsed.state,
      });
      if (!candidate.success) {
        return {
          ok: false,
          message: 'Backup payload failed schema validation.',
        };
      }
      if (dryRun) {
        return {
          ok: true,
          message: 'Dry-run validation passed.',
        };
      }
      updateState(set, () => candidate.data.state);
      return {
        ok: true,
        message: 'Backup restored successfully.',
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Backup restore failed.',
      };
    }
  },
}));

if (hasAsyncLoad(persistence)) {
  void persistence
    .loadAsync()
    .then((loaded) => {
      const parsed = sophonStoreSchema.safeParse(loaded);
      if (!parsed.success) {
        return;
      }
      useSophonStore.setState({
        state: parsed.data.state,
      });
    })
    .catch(() => {
      // Offline module ignores async hydration failures and keeps last known in-memory defaults.
    });
}

