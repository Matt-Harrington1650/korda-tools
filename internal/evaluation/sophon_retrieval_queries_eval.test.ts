// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STORAGE_KEYS } from '../../src/storage/keys';
import { useSophonStore } from '../../src/features/sophon/store/sophonStore';

const QUERIES = [
  'Summarize major technical points in the indexed fixtures.',
  'List standards and specification references.',
  'What evidence mentions pressure rating or equipment tags?',
  'Show any notes related to RFI handling.',
  'What source appears to contain table-oriented content?',
  'What does the walkthrough fixture mention about pumps?',
  'Give a short executive summary of indexed corpus.',
  'What ingestion constraints are visible from source configuration?',
  'List any safety or risk-related terms.',
  'Provide a concise answer with grounding references.',
] as const;

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
        activeSnapshotId: undefined,
      },
      tuning: {
        ...prev.state.tuning,
        retrieverTopK: 20,
        scoreThreshold: 0.15,
        explainRetrieval: true,
      },
      audit: [],
      logs: [],
      metrics: [],
      activity: [],
      lastRetrieval: undefined,
    },
  }));
};

describe('Sophon retrieval lab evaluation', () => {
  it('runs representative retrieval queries and exports report artifacts', () => {
    resetStore();
    const artifactsDir = resolve(process.cwd(), 'internal/evaluation/artifacts');
    mkdirSync(artifactsDir, { recursive: true });
    const store = useSophonStore.getState();

    store.addSource({
      name: 'Retrieval Fixture Source',
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
    tickUntilDone();

    const queryResults = QUERIES.map((query) => {
      store.runRetrievalTest(query);
      const retrieval = useSophonStore.getState().state.lastRetrieval;
      return {
        query,
        answer: retrieval?.answer ?? '',
        passageCount: retrieval?.passages.length ?? 0,
        passages: retrieval?.passages ?? [],
      };
    });

    store.updateTuning({ retrieverTopK: 2 });
    store.runRetrievalTest('Top-k sensitivity check query');
    const lowTopK = useSophonStore.getState().state.lastRetrieval?.passages.length ?? 0;

    store.updateTuning({ retrieverTopK: 20 });
    store.runRetrievalTest('Top-k sensitivity check query');
    const highTopK = useSophonStore.getState().state.lastRetrieval?.passages.length ?? 0;

    const report = {
      module: 'Sophon Retrieval Lab',
      generatedAt: new Date().toISOString(),
      queryCount: QUERIES.length,
      queryResults,
      tuningComparison: {
        lowTopK,
        highTopK,
        changed: lowTopK !== highTopK,
      },
      indexState: useSophonStore.getState().state.index,
      tuningState: useSophonStore.getState().state.tuning,
      auditCount: useSophonStore.getState().state.audit.length,
    };

    writeFileSync(
      resolve(artifactsDir, 'sophon_retrieval_queries_report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    const text = [
      'Sophon Retrieval Query Evaluation',
      `Generated: ${report.generatedAt}`,
      `Queries: ${report.queryCount}`,
      `Top-k comparison (2 vs 20): ${lowTopK} vs ${highTopK}`,
      `Changed: ${report.tuningComparison.changed}`,
      '',
      ...queryResults.map((item, idx) => `${idx + 1}. ${item.query} -> passages=${item.passageCount}`),
    ].join('\n');
    writeFileSync(resolve(artifactsDir, 'sophon_retrieval_queries_report.txt'), `${text}\n`);

    expect(queryResults.length).toBe(10);
    expect(queryResults.every((item) => item.answer.length > 0)).toBe(true);
  });
});

