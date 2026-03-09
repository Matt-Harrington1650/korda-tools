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

const resetStore = (): void => {
  window.localStorage.removeItem(STORAGE_KEYS.sophon);
  useSophonStore.getState().stopRuntime();
  useSophonStore.setState((prev) => ({
    ...prev,
    state: {
      ...prev.state,
      runtime: { ...prev.state.runtime, status: 'stopped' },
      offlineOnlyEnforced: true,
      egressBlocked: true,
      sources: [],
      jobs: [],
      blockedEgressAttempts: [],
      index: {
        ...prev.state.index,
        docCount: 0,
        chunkCount: 0,
        revision: 1,
        snapshots: [],
        activeSnapshotId: undefined,
      },
      audit: [],
      logs: [],
      metrics: [],
      activity: [],
    },
  }));
};

describe('Sophon index lifecycle evaluation', () => {
  it('captures rebuild/snapshot/restore/publish behavior for verification', () => {
    resetStore();
    const artifactsDir = resolve(process.cwd(), 'internal/evaluation/artifacts');
    mkdirSync(artifactsDir, { recursive: true });
    const store = useSophonStore.getState();

    store.addSource({
      name: 'Index Fixture Source',
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
    tickUntilSettled();
    store.createSnapshot('S1-baseline');
    const s1 = useSophonStore.getState().state.index.snapshots[0];
    expect(s1).toBeDefined();
    if (!s1) {
      return;
    }

    const countsAfterS1 = {
      docCount: useSophonStore.getState().state.index.docCount,
      chunkCount: useSophonStore.getState().state.index.chunkCount,
    };

    // mutate index
    store.queueIngestion({ sourceId, dryRun: false, safeMode: false });
    tickUntilSettled();
    store.compactIndex();
    store.createSnapshot('S2-after-second-pass');
    const snapshots = useSophonStore.getState().state.index.snapshots;
    const s2 = snapshots.find((snap) => snap.name === 'S2-after-second-pass');
    expect(s2).toBeDefined();

    // restore + publish baseline
    store.restoreSnapshot(s1.id);
    store.publishSnapshot(s1.id);
    const afterRestore = {
      docCount: useSophonStore.getState().state.index.docCount,
      chunkCount: useSophonStore.getState().state.index.chunkCount,
      activeSnapshotId: useSophonStore.getState().state.index.activeSnapshotId,
    };

    // invalid restore request should be a no-op
    const beforeInvalid = JSON.stringify(useSophonStore.getState().state.index);
    store.restoreSnapshot('snapshot-does-not-exist');
    const afterInvalid = JSON.stringify(useSophonStore.getState().state.index);

    const payload = {
      generatedAt: new Date().toISOString(),
      snapshots: useSophonStore.getState().state.index.snapshots,
      countsAfterS1,
      countsAfterRestore: afterRestore,
      restoreMatchedBaseline:
        afterRestore.docCount === countsAfterS1.docCount &&
        afterRestore.chunkCount === countsAfterS1.chunkCount,
      invalidRestoreNoOp: beforeInvalid === afterInvalid,
      auditCount: useSophonStore.getState().state.audit.length,
    };
    writeFileSync(
      resolve(artifactsDir, 'sophon_index_lifecycle_eval.json'),
      `${JSON.stringify(payload, null, 2)}\n`,
    );

    expect(payload.restoreMatchedBaseline).toBe(true);
    expect(payload.countsAfterRestore.activeSnapshotId).toBe(s1.id);
  });
});

