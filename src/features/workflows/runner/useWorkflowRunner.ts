import { useCallback } from 'react';
import type { Workflow } from '../../../domain/workflow';
import { useSettingsStore } from '../../settings/store';
import { useToolRegistryStore } from '../../tools/store/toolRegistryStore';
import { useWorkflowRunStore } from '../store/workflowRunStore';
import { cancelWorkflowRun, startLinearWorkflowRun } from './workflowRunner';

export const useWorkflowRunner = () => {
  const defaultTimeoutMs = useSettingsStore((state) => state.settings.defaultTimeoutMs);
  const getToolById = useToolRegistryStore((state) => state.getToolById);
  const upsertRun = useWorkflowRunStore((state) => state.upsertRun);
  const upsertNodeRun = useWorkflowRunStore((state) => state.upsertNodeRun);

  const startWorkflow = useCallback(
    (workflow: Workflow): string => {
      const started = startLinearWorkflowRun({
        workflow,
        defaultTimeoutMs,
        resolveTool: (toolId) => getToolById(toolId),
        callbacks: {
          onRunUpsert: upsertRun,
          onNodeRunUpsert: upsertNodeRun,
        },
      });

      void started.completion;
      return started.runId;
    },
    [defaultTimeoutMs, getToolById, upsertNodeRun, upsertRun],
  );

  return {
    startWorkflow,
    cancelWorkflowRun,
  };
};
