import { useEffect, useMemo, useRef, useState } from 'react';
import { createFileService, type RunAttachment } from '../../../desktop';
import type { ToolRunRequestSummary } from '../../../domain/log';
import type { Tool } from '../../../domain/tool';
import { executeToolWithPipelineStream } from '../../../execution';
import type { ExecutionActionType, ExecutionEvent, ExecutionResult } from '../../../execution';
import { previewText } from '../../../execution/helpers';
import { redactHeaders, redactText } from '../logRedaction';
import { useSettingsStore } from '../../settings/store';
import { useToolRunLogStore } from '../store/toolRunLogStore';

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
    payloadPreview: (() => {
      const payload = previewText(redactText(result.request.body ?? ''));

      if (!result.request.attachments || result.request.attachments.length === 0) {
        return payload;
      }

      const names = result.request.attachments.map((file) => file.name).join(', ');
      return `${payload} [files: ${result.request.attachments.length} - ${names}]`.trim();
    })(),
  };
};

const formatStatus = (event: Extract<ExecutionEvent, { type: 'status' }>): string => {
  if (event.message && event.message.trim().length > 0) {
    return event.message;
  }

  switch (event.phase) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'validating_config':
      return 'Validating configuration';
    case 'building_request':
      return 'Building request';
    case 'executing':
      return 'Executing';
    case 'normalizing_response':
      return 'Normalizing response';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Executing';
  }
};

const buildFallbackResult = (tool: Tool, actionType: ExecutionActionType, durationMs: number): ExecutionResult => {
  return {
    ok: false,
    actionType,
    toolType: tool.type,
    request: null,
    requestSummary: '',
    responseSummary: '',
    durationMs,
    error: {
      code: 'execution_error',
      message: 'Execution failed',
      details: 'Execution pipeline returned no result.',
    },
  };
};

export const useToolExecution = (tool: Tool | undefined) => {
  const fileService = useMemo(() => createFileService(), []);
  const defaultTimeoutMs = useSettingsStore((state) => state.settings.defaultTimeoutMs);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeAction, setActiveAction] = useState<ExecutionActionType | null>(null);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [executionStatus, setExecutionStatus] = useState('Idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [streamedOutput, setStreamedOutput] = useState('');
  const [attachments, setAttachments] = useState<RunAttachment[]>([]);
  const [fileMessage, setFileMessage] = useState('');
  const [fileError, setFileError] = useState('');
  const [isExportingOutput, setIsExportingOutput] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const appendLog = useToolRunLogStore((state) => state.appendLog);
  const allLogEntries = useToolRunLogStore((state) => state.entries);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<number | null>(null);

  const logs = useMemo(() => {
    if (!tool) {
      return [];
    }

    return allLogEntries.filter((entry) => entry.toolId === tool.id);
  }, [allLogEntries, tool]);

  const stopDurationTicker = (): void => {
    if (durationIntervalRef.current !== null) {
      window.clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };

  const startDurationTicker = (): void => {
    stopDurationTicker();
    startedAtRef.current = Date.now();
    setDurationMs(0);

    durationIntervalRef.current = window.setInterval(() => {
      if (!startedAtRef.current) {
        return;
      }

      setDurationMs(Date.now() - startedAtRef.current);
    }, 100);
  };

  const cancelExecution = (): void => {
    if (!abortControllerRef.current) {
      return;
    }

    setExecutionStatus('Cancelling...');
    abortControllerRef.current.abort(new DOMException('Execution cancelled.', 'AbortError'));
  };

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort(new DOMException('Execution cancelled.', 'AbortError'));
      stopDurationTicker();
    };
  }, []);

  useEffect(() => {
    setAttachments([]);
    setFileError('');
    setFileMessage('');
  }, [tool?.id]);

  const clearFileFeedback = (): void => {
    setFileError('');
    setFileMessage('');
  };

  const addAttachments = async (): Promise<void> => {
    clearFileFeedback();

    try {
      const nextFiles = await fileService.pickRunFiles({
        multiple: true,
      });

      if (nextFiles.length === 0) {
        return;
      }

      setAttachments((current) => {
        const ids = new Set(current.map((file) => file.id));
        const merged = [...current];

        nextFiles.forEach((file) => {
          if (!ids.has(file.id)) {
            merged.push(file);
          }
        });

        return merged;
      });
      setFileMessage(`${nextFiles.length} file${nextFiles.length === 1 ? '' : 's'} attached.`);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Failed to attach files.');
    }
  };

  const removeAttachment = (attachmentId: string): void => {
    setAttachments((current) => current.filter((file) => file.id !== attachmentId));
  };

  const clearAttachments = (): void => {
    setAttachments([]);
  };

  const exportRunOutput = async (): Promise<void> => {
    clearFileFeedback();

    if (!tool) {
      setFileError('Tool is unavailable.');
      return;
    }

    if (!lastResult && streamedOutput.trim().length === 0) {
      setFileError('No run output available to export.');
      return;
    }

    const safeName = tool.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tool';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suggestedName = `${safeName}-run-output-${timestamp}.json`;
    const contents = JSON.stringify(
      {
        toolId: tool.id,
        exportedAt: new Date().toISOString(),
        status: lastResult?.ok === true ? 'success' : lastResult?.ok === false ? 'error' : 'stream',
        output: streamedOutput,
        result: lastResult,
      },
      null,
      2,
    );

    setIsExportingOutput(true);
    try {
      const saved = await fileService.saveRunOutput({
        suggestedName,
        contents,
      });

      if (!saved.saved) {
        setFileMessage('Export canceled.');
        return;
      }

      setFileMessage(saved.path ? `Exported to ${saved.path}` : 'Exported run output.');
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Failed to export run output.');
    } finally {
      setIsExportingOutput(false);
    }
  };

  const executeAction = async (actionType: ExecutionActionType): Promise<ExecutionResult | null> => {
    if (!tool) {
      return null;
    }

    setStreamedOutput('');
    setProgress(null);
    setExecutionStatus('Queued');
    setIsExecuting(true);
    setActiveAction(actionType);
    startDurationTicker();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let streamedChunkOutput = '';

    try {
      let finalResult: ExecutionResult | null = null;
      const stream = executeToolWithPipelineStream({
        tool,
        actionType,
        timeoutMs: defaultTimeoutMs,
        signal: controller.signal,
        stream: actionType === 'run',
        attachments: actionType === 'run' ? attachments : [],
      });

      for await (const event of stream) {
        if (event.type === 'status') {
          setExecutionStatus(formatStatus(event));
          continue;
        }

        if (event.type === 'progress') {
          setProgress(event.progress);
          if (event.message) {
            setExecutionStatus(event.message);
          }
          continue;
        }

        if (event.type === 'chunk') {
          streamedChunkOutput = `${streamedChunkOutput}${event.chunk}`;
          setStreamedOutput(streamedChunkOutput);
          continue;
        }

        if (event.type === 'error') {
          setExecutionStatus(event.error.message);
          continue;
        }

        if (event.type === 'result') {
          finalResult = event.result;
        }
      }

      const result = finalResult ?? buildFallbackResult(tool, actionType, Date.now() - (startedAtRef.current ?? Date.now()));
      setLastResult(result);
      setDurationMs(result.durationMs);

      if (streamedChunkOutput.trim().length === 0) {
        if (result.ok) {
          setStreamedOutput(result.response.bodyPreview);
        } else {
          setStreamedOutput(`${result.error.message}\n${result.error.details}`);
        }
      }

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

      setExecutionStatus(result.ok ? 'Completed' : result.error.code === 'cancelled' ? 'Cancelled' : 'Failed');
      return result;
    } finally {
      abortControllerRef.current = null;
      stopDurationTicker();
      setActiveAction(null);
      setIsExecuting(false);
    }
  };

  return {
    isExecuting,
    activeAction,
    lastResult,
    executionStatus,
    progress,
    streamedOutput,
    attachments,
    fileMessage,
    fileError,
    isExportingOutput,
    durationMs,
    logs,
    addAttachments,
    removeAttachment,
    clearAttachments,
    exportRunOutput,
    cancelExecution,
    executeAction,
  };
};
