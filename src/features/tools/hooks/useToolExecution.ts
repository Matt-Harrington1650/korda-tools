import { useMemo, useState } from 'react';
import type { ToolRunRequestSummary } from '../../../domain/log';
import type { Tool } from '../../../domain/tool';
import { executeToolWithPipeline } from '../../../execution';
import type { ExecutionActionType, ExecutionResult } from '../../../execution';
import { previewText } from '../../../execution/helpers';
import { useSettingsStore } from '../../settings/store';
import { useToolRunLogStore } from '../store/toolRunLogStore';

const REDACTED = '[REDACTED]';

const SENSITIVE_HEADER_KEY_PATTERN =
  /authorization|proxy-authorization|api[-_]?key|token|secret|password|cookie|set-cookie/i;

const redactHeaders = (headers: Record<string, string>): Record<string, string> => {
  return Object.entries(headers).reduce<Record<string, string>>((accumulator, [key, value]) => {
    accumulator[key] = SENSITIVE_HEADER_KEY_PATTERN.test(key) ? REDACTED : value;
    return accumulator;
  }, {});
};

const redactText = (value: string): string => {
  if (!value) {
    return '';
  }

  return value
    .replace(/Bearer\\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/\"(api[_-]?key|token|secret|password)\"\\s*:\\s*\"[^\"]*\"/gi, '"$1":"[REDACTED]"');
};

const toRequestSummary = (result: ExecutionResult): ToolRunRequestSummary => {
  if (!result.request) {
    return {
      method: 'n/a',
      url: 'n/a',
      headers: {},
      payloadPreview: '',
    };
  }

  return {
    method: result.request.method,
    url: result.request.url,
    headers: redactHeaders(result.request.headers),
    payloadPreview: previewText(redactText(result.request.body ?? '')),
  };
};

export const useToolExecution = (tool: Tool | undefined) => {
  const defaultTimeoutMs = useSettingsStore((state) => state.settings.defaultTimeoutMs);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeAction, setActiveAction] = useState<ExecutionActionType | null>(null);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const appendLog = useToolRunLogStore((state) => state.appendLog);
  const allLogEntries = useToolRunLogStore((state) => state.entries);

  const logs = useMemo(() => {
    if (!tool) {
      return [];
    }

    return allLogEntries.filter((entry) => entry.toolId === tool.id);
  }, [allLogEntries, tool]);

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
        timeoutMs: defaultTimeoutMs,
      });

      setLastResult(result);
      appendLog({
        toolId: tool.id,
        actionType,
        requestSummary: toRequestSummary(result),
        responseSummary: {
          statusCode: result.ok ? result.response.statusCode : null,
          preview: result.ok ? result.response.bodyPreview : `${result.error.message} ${result.error.details}`,
          durationMs: result.durationMs,
        },
        success: result.ok,
        errorDetails: result.ok ? '' : `${result.error.message}\n${result.error.details}`,
      });

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
    logs,
    executeAction,
  };
};
