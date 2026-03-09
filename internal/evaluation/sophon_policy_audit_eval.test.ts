// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STORAGE_KEYS } from '../../src/storage/keys';
import { useSophonStore } from '../../src/features/sophon/store/sophonStore';

const tickUntilDone = (maxTicks = 260): void => {
  for (let i = 0; i < maxTicks; i += 1) {
    useSophonStore.getState().pipelineTick();
    const active = useSophonStore
      .getState()
      .state.jobs.some((job) => ['queued', 'running', 'paused'].includes(job.status));
    if (!active) {
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
      role: 'admin',
      offlineOnlyEnforced: true,
      egressBlocked: true,
      blockedEgressAttempts: [],
      sources: [],
      jobs: [],
      audit: [],
      logs: [],
      metrics: [],
      activity: [],
    },
  }));
};

describe('Sophon policy and audit evaluation', () => {
  it('captures audit behavior, offline gate evidence, and RBAC posture', () => {
    resetStore();
    const artifactsDir = resolve(process.cwd(), 'internal/evaluation/artifacts');
    mkdirSync(artifactsDir, { recursive: true });
    const store = useSophonStore.getState();

    store.startRuntime();
    store.addSource({
      name: 'Policy Fixture Source',
      path: resolve(process.cwd(), 'internal/evaluation/fixtures'),
      includePatterns: ['**/*.pdf'],
      excludePatterns: ['**/archive/**'],
    });
    const sourceId = useSophonStore.getState().state.sources[0]?.id;
    expect(sourceId).toBeTruthy();
    if (!sourceId) {
      return;
    }
    store.queueIngestion({ sourceId, dryRun: false, safeMode: true });
    tickUntilDone();
    store.runRetrievalTest('https://blocked.example/sensitive-egress-check');

    // RBAC posture check: viewer role currently still permits source/job actions.
    store.setRole('viewer');
    const sourceCountBeforeViewerAction = useSophonStore.getState().state.sources.length;
    store.addSource({
      name: 'Viewer Added Source',
      path: 'C:/viewer/path',
      includePatterns: ['**/*.txt'],
      excludePatterns: [],
    });
    const sourceCountAfterViewerAction = useSophonStore.getState().state.sources.length;

    const payload = {
      generatedAt: new Date().toISOString(),
      roleAfterSwitch: useSophonStore.getState().state.role,
      blockedEgressAttempts: useSophonStore.getState().state.blockedEgressAttempts,
      blockedEgressCount: useSophonStore.getState().state.blockedEgressAttempts.length,
      auditActionsSample: useSophonStore
        .getState()
        .state.audit.slice(0, 20)
        .map((entry) => entry.action),
      auditCount: useSophonStore.getState().state.audit.length,
      viewerMutationAllowed: sourceCountAfterViewerAction > sourceCountBeforeViewerAction,
    };
    writeFileSync(
      resolve(artifactsDir, 'sophon_policy_audit_eval.json'),
      `${JSON.stringify(payload, null, 2)}\n`,
    );

    expect(payload.blockedEgressCount).toBeGreaterThan(0);
    expect(payload.auditCount).toBeGreaterThan(0);
  });
});

