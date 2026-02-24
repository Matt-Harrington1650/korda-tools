import { useState } from 'react';
import type { Tool } from '../../../domain/tool';
import { executeToolWithPipeline } from '../../../execution';
import type { ExecutionActionType, ExecutionResult } from '../../../execution';
import { createToolId } from '../../../lib/ids';

type LocalExecutionLog = {
  id: string;
  actionType: ExecutionActionType;
  timestamp: string;
  success: boolean;
  requestSummary: string;
  responseSummary: string;
  errorDetails: string;
};

const DEFAULT_TIMEOUT_MS = 10_000;

export const useToolExecution = (tool: Tool | undefined) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeAction, setActiveAction] = useState<ExecutionActionType | null>(null);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [localLogs, setLocalLogs] = useState<LocalExecutionLog[]>([]);

  const executeAction = async (actionType: ExecutionActionType): Promise<ExecutionResult | null> => {
    if (!tool) {
      return null;
    }

    setIsExecuting(true);
    setActiveAction(actionType);

    try {
      const result = await executeToolWithPipeline({
        tool,
        actionType,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });

      setLastResult(result);
      setLocalLogs((previous) => [
        {
          id: createToolId(),
          actionType,
          timestamp: new Date().toISOString(),
          success: result.ok,
          requestSummary: result.requestSummary,
          responseSummary: result.responseSummary,
          errorDetails: result.ok ? '' : result.error.details,
        },
        ...previous,
      ]);

      return result;
    } finally {
      setActiveAction(null);
      setIsExecuting(false);
    }
  };

  return {
    isExecuting,
    activeAction,
    lastResult,
    localLogs,
    executeAction,
  };
};
