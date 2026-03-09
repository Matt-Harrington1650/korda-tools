// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STORAGE_KEYS } from '../../src/storage/keys';
import { useSophonStore } from '../../src/features/sophon/store/sophonStore';

const STAGES_MAX_TICKS = 220;

const resetStore = (): void => {
  window.localStorage.removeItem(STORAGE_KEYS.sophon);
  useSophonStore.getState().stopRuntime();
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
        explainRetrieval: true,
        maxIngestionWorkers: 4,
        forceCpuOnly: false,
      },
      metrics: [],
      logs: [],
      audit: [],
      activity: [],
    },
  }));
};

const tickToCompletion = (): void => {
  for (let i = 0; i < STAGES_MAX_TICKS; i += 1) {
    useSophonStore.getState().pipelineTick();
    const running = useSophonStore
      .getState()
      .state.jobs.some((job) => job.status === 'queued' || job.status === 'running' || job.status === 'paused');
    if (!running) {
      return;
    }
  }
};

describe('Sophon OOB evaluation artifact generation', () => {
  const artifactsDir = resolve(process.cwd(), 'internal/evaluation/artifacts');

  beforeEach(() => {
    mkdirSync(artifactsDir, { recursive: true });
    resetStore();
  });

  it('generates retrieval and backup artifacts for OOB verification', () => {
    const store = useSophonStore.getState();
    store.addSource({
      name: 'Fixture Source',
      path: resolve(process.cwd(), 'internal/evaluation/fixtures'),
      includePatterns: ['**/*.pdf', '**/*.txt', '**/*.md', '**/*.docx'],
      excludePatterns: ['**/archive/**'],
    });
    const sourceId = useSophonStore.getState().state.sources[0]?.id;
    expect(sourceId).toBeTruthy();
    if (!sourceId) {
      return;
    }

    store.startRuntime();
    store.queueIngestion({ sourceId, dryRun: false, safeMode: true });
    tickToCompletion();

    const completed = useSophonStore.getState().state.jobs[0];
    expect(completed?.status).toBe('completed');

    store.runRetrievalTest('Summarize indexed fixture content and include source grounding.');
    const retrieval = useSophonStore.getState().state.lastRetrieval;
    expect(retrieval).toBeDefined();

    const reportJson = {
      module: 'Sophon Retrieval Lab',
      generatedAt: new Date().toISOString(),
      retrieval,
      index: useSophonStore.getState().state.index,
      tuning: useSophonStore.getState().state.tuning,
    };
    writeFileSync(resolve(artifactsDir, 'sophon_retrieval_report.json'), JSON.stringify(reportJson, null, 2));

    const lines = [
      'Sophon Retrieval Report',
      `Generated: ${reportJson.generatedAt}`,
      `Query: ${retrieval?.query ?? 'n/a'}`,
      `Answer: ${retrieval?.answer ?? 'n/a'}`,
      `Passages: ${retrieval?.passages.length ?? 0}`,
      `Index docs/chunks: ${reportJson.index.docCount}/${reportJson.index.chunkCount}`,
    ];
    writeFileSync(resolve(artifactsDir, 'sophon_retrieval_report.txt'), `${lines.join('\n')}\n`);

    const backupJson = store.exportBackupJson();
    writeFileSync(resolve(artifactsDir, 'sophon_backup_bundle_b1.json'), backupJson);

    const dryRun = store.importBackupJson(backupJson, true);
    expect(dryRun.ok).toBe(true);
    expect(dryRun.message).toContain('Dry-run');

    const beforeFailure = JSON.stringify(useSophonStore.getState().state);
    const tampered = store.importBackupJson('{"state":{"invalid":true}}', false);
    expect(tampered.ok).toBe(false);
    const afterFailure = JSON.stringify(useSophonStore.getState().state);
    expect(afterFailure).toBe(beforeFailure);

    // Simulated clean restore: reset then import bundle.
    resetStore();
    const restore = useSophonStore.getState().importBackupJson(backupJson, false);
    expect(restore.ok).toBe(true);
    useSophonStore.getState().runRetrievalTest('post-restore retrieval check');
    expect(useSophonStore.getState().state.lastRetrieval?.answer.length).toBeGreaterThan(0);
  });
});

