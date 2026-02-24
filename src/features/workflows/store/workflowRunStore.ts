import { create } from 'zustand';
import type { WorkflowNodeRun, WorkflowRun } from '../../../domain/workflow';
import {
  workflowNodeRunHistorySchema,
  workflowNodeRunSchema,
  workflowNodeRunSchemaVersion,
  workflowRunHistorySchema,
  workflowRunSchema,
  workflowRunSchemaVersion,
} from '../../../schemas/workflowSchemas';
import { createStorageEngine, hasAsyncLoad } from '../../../storage/createStorageEngine';
import { STORAGE_KEYS } from '../../../storage/keys';
import { migrateWorkflowNodeRuns, migrateWorkflowRuns } from '../../../storage/migrations';

const MAX_WORKFLOW_RUNS = 300;
const MAX_WORKFLOW_NODE_RUNS = 3000;

const runsPersistence = createStorageEngine({
  key: STORAGE_KEYS.workflowRuns,
  schema: workflowRunHistorySchema,
  defaultValue: {
    version: workflowRunSchemaVersion,
    entries: [],
  },
  migrate: migrateWorkflowRuns,
});

const nodeRunsPersistence = createStorageEngine({
  key: STORAGE_KEYS.workflowNodeRuns,
  schema: workflowNodeRunHistorySchema,
  defaultValue: {
    version: workflowNodeRunSchemaVersion,
    entries: [],
  },
  migrate: migrateWorkflowNodeRuns,
});

const persistRuns = (runs: WorkflowRun[]): void => {
  runsPersistence.save({
    version: workflowRunSchemaVersion,
    entries: runs.slice(0, MAX_WORKFLOW_RUNS),
  });
};

const persistNodeRuns = (nodeRuns: WorkflowNodeRun[]): void => {
  nodeRunsPersistence.save({
    version: workflowNodeRunSchemaVersion,
    entries: nodeRuns.slice(0, MAX_WORKFLOW_NODE_RUNS),
  });
};

const upsertById = <T extends { id: string }>(items: T[], next: T): T[] => {
  const existingIndex = items.findIndex((item) => item.id === next.id);
  if (existingIndex === -1) {
    return [next, ...items];
  }

  const cloned = [...items];
  cloned[existingIndex] = next;
  return cloned;
};

type WorkflowRunState = {
  runs: WorkflowRun[];
  nodeRuns: WorkflowNodeRun[];
  upsertRun: (run: WorkflowRun) => WorkflowRun;
  upsertNodeRun: (nodeRun: WorkflowNodeRun) => WorkflowNodeRun;
  removeRunsForWorkflow: (workflowId: string) => void;
  getRunsByWorkflowId: (workflowId: string) => WorkflowRun[];
  getNodeRunsByWorkflowRunId: (workflowRunId: string) => WorkflowNodeRun[];
};

export const useWorkflowRunStore = create<WorkflowRunState>((set, get) => ({
  runs: runsPersistence.load().entries,
  nodeRuns: nodeRunsPersistence.load().entries,
  upsertRun: (run) => {
    const parsed = workflowRunSchema.parse(run);
    const nextRuns = upsertById(get().runs, parsed)
      .slice(0, MAX_WORKFLOW_RUNS)
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
    persistRuns(nextRuns);
    set({ runs: nextRuns });
    return parsed;
  },
  upsertNodeRun: (nodeRun) => {
    const parsed = workflowNodeRunSchema.parse(nodeRun);
    const nextNodeRuns = upsertById(get().nodeRuns, parsed)
      .slice(0, MAX_WORKFLOW_NODE_RUNS)
      .sort((left, right) => {
        const leftTs = Date.parse(left.startedAt ?? left.finishedAt ?? new Date(0).toISOString());
        const rightTs = Date.parse(right.startedAt ?? right.finishedAt ?? new Date(0).toISOString());
        return leftTs - rightTs;
      });
    persistNodeRuns(nextNodeRuns);
    set({ nodeRuns: nextNodeRuns });
    return parsed;
  },
  removeRunsForWorkflow: (workflowId) => {
    const nextRuns = get().runs.filter((entry) => entry.workflowId !== workflowId);
    const allowedRunIds = new Set(nextRuns.map((entry) => entry.id));
    const nextNodeRuns = get().nodeRuns.filter((entry) => allowedRunIds.has(entry.workflowRunId));
    persistRuns(nextRuns);
    persistNodeRuns(nextNodeRuns);
    set({
      runs: nextRuns,
      nodeRuns: nextNodeRuns,
    });
  },
  getRunsByWorkflowId: (workflowId) => {
    return get().runs
      .filter((entry) => entry.workflowId === workflowId)
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
  },
  getNodeRunsByWorkflowRunId: (workflowRunId) => {
    return get().nodeRuns
      .filter((entry) => entry.workflowRunId === workflowRunId)
      .sort((left, right) => {
        const leftTs = Date.parse(left.startedAt ?? left.finishedAt ?? new Date(0).toISOString());
        const rightTs = Date.parse(right.startedAt ?? right.finishedAt ?? new Date(0).toISOString());
        return leftTs - rightTs;
      });
  },
}));

if (hasAsyncLoad(runsPersistence)) {
  void runsPersistence
    .loadAsync()
    .then((persisted) => {
      useWorkflowRunStore.setState({
        runs: persisted.entries,
      });
    })
    .catch(() => {
      // TODO(extension): add telemetry hook for async workflow run hydration failures.
    });
}

if (hasAsyncLoad(nodeRunsPersistence)) {
  void nodeRunsPersistence
    .loadAsync()
    .then((persisted) => {
      useWorkflowRunStore.setState({
        nodeRuns: persisted.entries,
      });
    })
    .catch(() => {
      // TODO(extension): add telemetry hook for async workflow node run hydration failures.
    });
}
