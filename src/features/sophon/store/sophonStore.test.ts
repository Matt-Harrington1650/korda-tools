// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../../storage/keys';
import { useSophonStore } from './sophonStore';

const tickUntilDone = (max = 180): void => {
  for (let i = 0; i < max; i += 1) {
    useSophonStore.getState().pipelineTick();
    const queuedOrRunning = useSophonStore
      .getState()
      .state.jobs.some((job) => job.status === 'queued' || job.status === 'running');
    if (!queuedOrRunning) {
      return;
    }
  }
};

describe('sophonStore lifecycle', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEYS.sophon);
    const state = useSophonStore.getState();
    state.stopRuntime();
    useSophonStore.setState((prev) => ({
      ...prev,
      state: {
        version: 1,
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
          embeddingModel: 'nvidia/llama-3.2-nv-embedqa-1b-v2',
          integrityStatus: 'unknown',
          revision: 1,
          snapshots: [],
        },
        tuning: {
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
        },
        metrics: [],
        logs: [],
        audit: [],
        activity: [],
      },
    }));
  });

  it('queues and completes a staged ingestion job', () => {
    const store = useSophonStore.getState();
    store.addSource({
      name: 'EPC Drawings',
      path: 'D:/epc/drawings',
      includePatterns: ['**/*.pdf'],
      excludePatterns: ['**/archive/**'],
    });
    const sourceId = useSophonStore.getState().state.sources[0]?.id;
    expect(sourceId).toBeTruthy();
    if (!sourceId) {
      return;
    }

    store.startRuntime();
    store.queueIngestion({ sourceId, dryRun: false, safeMode: true });
    tickUntilDone();

    const next = useSophonStore.getState().state;
    expect(next.jobs.length).toBe(1);
    expect(next.jobs[0].status).toBe('completed');
    expect(next.jobs[0].stages.every((stage) => stage.status === 'completed')).toBe(true);
    expect(next.index.docCount).toBeGreaterThan(0);
    expect(next.index.chunkCount).toBeGreaterThan(0);
  });

  it('creates and restores snapshot', () => {
    const store = useSophonStore.getState();
    store.addSource({ name: 'Data', path: 'D:/data' });
    const sourceId = useSophonStore.getState().state.sources[0]?.id;
    if (!sourceId) {
      return;
    }
    store.startRuntime();
    store.runIngestion(sourceId);
    tickUntilDone();
    store.createSnapshot('baseline');
    const snap = useSophonStore.getState().state.index.snapshots[0];
    expect(snap?.name).toBe('baseline');

    store.compactIndex();
    store.restoreSnapshot(snap.id);
    const next = useSophonStore.getState().state;
    expect(next.index.docCount).toBe(snap.docCount);
    expect(next.index.chunkCount).toBe(snap.chunkCount);
    expect(next.index.activeSnapshotId).toBe(snap.id);
  });

  it('records blocked egress evidence from retrieval lab', () => {
    const store = useSophonStore.getState();
    store.runRetrievalTest('https://example.com/should-block');
    const next = useSophonStore.getState().state;
    expect(next.blockedEgressAttempts.length).toBe(1);
    expect(next.blockedEgressAttempts[0]?.reason).toContain('SOPHON_EGRESS_BLOCK_REQUIRED');
  });
});
