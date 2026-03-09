// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STORAGE_KEYS } from '../../src/storage/keys';
import { useSophonStore } from '../../src/features/sophon/store/sophonStore';

const tickUntilSettled = (maxTicks = 260): void => {
  for (let i = 0; i < maxTicks; i += 1) {
    useSophonStore.getState().pipelineTick();
    const running = useSophonStore
      .getState()
      .state.jobs.some((job) => ['queued', 'running', 'paused'].includes(job.status));
    if (!running) {
      return;
    }
  }
};

const reset = (): void => {
  window.localStorage.removeItem(STORAGE_KEYS.sophon);
  useSophonStore.getState().stopRuntime();
  useSophonStore.setState((prev) => ({
    ...prev,
    state: {
      ...prev.state,
      runtime: {
        ...prev.state.runtime,
        status: 'stopped',
      },
      offlineOnlyEnforced: true,
      egressBlocked: true,
      sources: [],
      jobs: [],
      blockedEgressAttempts: [],
      index: {
        ...prev.state.index,
        docCount: 0,
        chunkCount: 0,
        snapshots: [],
      },
      audit: [],
      logs: [],
      metrics: [],
      activity: [],
    },
  }));
};

describe('Sophon ingestion reliability evaluation', () => {
  it('captures pause/resume/cancel/retry and idempotency signals', () => {
    reset();
    const artifactsDir = resolve(process.cwd(), 'internal/evaluation/artifacts');
    mkdirSync(artifactsDir, { recursive: true });

    const store = useSophonStore.getState();
    store.addSource({
      name: 'Reliability Fixture Source',
      path: resolve(process.cwd(), 'internal/evaluation/fixtures'),
      includePatterns: ['**/*.pdf', '**/*.txt', '**/*.md', '**/*.docx'],
      excludePatterns: ['**/archive/**'],
    });
    const source = useSophonStore.getState().state.sources[0];
    expect(source).toBeDefined();
    if (!source) {
      return;
    }

    store.startRuntime();
    store.queueIngestion({ sourceId: source.id, dryRun: false, safeMode: true });
    store.pipelineTick();
    const firstJob = useSophonStore.getState().state.jobs[0];
    expect(firstJob).toBeDefined();
    if (!firstJob) {
      return;
    }

    store.pauseJob(firstJob.id);
    const pausedStatus = useSophonStore.getState().state.jobs[0]?.status;
    store.resumeJob(firstJob.id);
    const resumedStatus = useSophonStore.getState().state.jobs[0]?.status;
    tickUntilSettled();

    const firstComplete = useSophonStore.getState().state.jobs[0];
    const firstDocCount = useSophonStore.getState().state.index.docCount;
    const firstChunkCount = useSophonStore.getState().state.index.chunkCount;

    // Cancel flow
    store.queueIngestion({ sourceId: source.id, dryRun: false, safeMode: true });
    const secondJob = useSophonStore.getState().state.jobs.find((job) => job.id !== firstJob.id);
    if (secondJob) {
      store.cancelJob(secondJob.id);
      store.retryJob(secondJob.id);
    }
    tickUntilSettled();

    const retryJob = useSophonStore
      .getState()
      .state.jobs.find((job) => secondJob && job.parentJobId === secondJob.id);
    const secondPassDocCount = useSophonStore.getState().state.index.docCount;
    const secondPassChunkCount = useSophonStore.getState().state.index.chunkCount;

    const payload = {
      generatedAt: new Date().toISOString(),
      sourceId: source.id,
      sourceSettings: source.settings,
      firstJob: {
        id: firstJob.id,
        pausedStatus,
        resumedStatus,
        finalStatus: firstComplete?.status,
      },
      retryFlow: {
        cancelledJobId: secondJob?.id ?? null,
        retryJobId: retryJob?.id ?? null,
        retryJobStatus: retryJob?.status ?? null,
      },
      indexStats: {
        firstDocCount,
        firstChunkCount,
        secondPassDocCount,
        secondPassChunkCount,
        idempotentDocCount: firstDocCount === secondPassDocCount,
        idempotentChunkCount: firstChunkCount === secondPassChunkCount,
      },
      auditCount: useSophonStore.getState().state.audit.length,
      logCount: useSophonStore.getState().state.logs.length,
    };

    writeFileSync(
      resolve(artifactsDir, 'sophon_ingestion_reliability_eval.json'),
      `${JSON.stringify(payload, null, 2)}\n`,
    );

    expect(payload.firstJob.finalStatus).toBe('completed');
    expect(payload.retryFlow.cancelledJobId).toBeTruthy();
  });
});
