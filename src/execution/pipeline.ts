import type { Tool } from '../domain/tool';
import { createRequestSummary, previewText } from './helpers';
import { toolAdapterRegistry } from './registry';
import type { ExecutionResult } from './types';
import type { ToolAdapterRegistry } from './ToolAdapterRegistry';

type ExecuteToolOptions = {
  tool: Tool;
  actionType: 'test' | 'run';
  payload?: string;
  timeoutMs: number;
  registry?: ToolAdapterRegistry;
};

const toErrorDetails = (value: unknown): { message: string; details: string; stack?: string } => {
  if (value instanceof Error) {
    return {
      message: value.message,
      details: value.toString(),
      stack: value.stack,
    };
  }

  return {
    message: 'Execution failed',
    details: String(value),
  };
};

export const executeToolWithPipeline = async ({
  tool,
  actionType,
  payload,
  timeoutMs,
  registry = toolAdapterRegistry,
}: ExecuteToolOptions): Promise<ExecutionResult> => {
  const adapter = registry.get(tool.type);

  if (!adapter) {
    return {
      ok: false,
      actionType,
      toolType: tool.type,
      request: null,
      requestSummary: '',
      responseSummary: '',
      durationMs: 0,
      error: {
        code: 'adapter_not_found',
        message: `No adapter registered for tool type: ${tool.type}`,
        details: `Missing adapter registration for ${tool.type}`,
      },
    };
  }

  const validationErrors = adapter.validateConfig(tool, actionType);
  if (validationErrors.length > 0) {
    return {
      ok: false,
      actionType,
      toolType: tool.type,
      request: null,
      requestSummary: '',
      responseSummary: '',
      durationMs: 0,
      error: {
        code: 'invalid_tool_configuration',
        message: 'Tool configuration is invalid.',
        details: validationErrors.join(' '),
      },
    };
  }

  const request = adapter.buildRequest({
    tool,
    actionType,
    payload,
  });

  const requestSummary = createRequestSummary(request);
  const controller = new AbortController();
  const timeoutHandle = window.setTimeout(() => {
    controller.abort(new DOMException('Execution timed out.', 'AbortError'));
  }, timeoutMs);

  const start = performance.now();

  try {
    const raw = await adapter.execute(request, {
      actionType,
      signal: controller.signal,
      timeoutMs,
    });

    const normalized = adapter.normalizeResponse(raw, request);
    const durationMs = Math.round(performance.now() - start);

    return {
      ok: true,
      actionType,
      toolType: tool.type,
      request,
      response: normalized,
      requestSummary,
      responseSummary: `${normalized.statusCode ?? 'n/a'} ${previewText(normalized.bodyPreview)}`,
      durationMs,
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    const parsedError = toErrorDetails(error);

    const timeoutTriggered =
      parsedError.message.includes('AbortError') ||
      parsedError.message.toLowerCase().includes('timed out') ||
      parsedError.message.toLowerCase().includes('abort');

    return {
      ok: false,
      actionType,
      toolType: tool.type,
      request,
      requestSummary,
      responseSummary: '',
      durationMs,
      error: {
        code: timeoutTriggered ? 'timeout' : 'execution_error',
        message: timeoutTriggered ? 'Execution timed out.' : parsedError.message,
        details: parsedError.details,
        stack: parsedError.stack,
      },
    };
  } finally {
    window.clearTimeout(timeoutHandle);
  }
};
