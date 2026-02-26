import { createSecretVault } from '../desktop';
import type { Tool } from '../domain/tool';
import { updateCredentialLastUsed } from '../features/credentials/credentialService';
import type { ToolAdapter } from './ToolAdapter';
import { createRequestSummary, previewText } from './helpers';
import { toolAdapterRegistry } from './registry';
import type {
  ExecutionAttachment,
  ExecutionEvent,
  ExecutionPipelineConfig,
  ExecutionQueueState,
  ExecutionResult,
  PipelineRetryPolicy,
  ToolExecutionError,
} from './types';

type AdapterResolver = {
  get: (type: Tool['type']) => ToolAdapter | null;
};

type ExecuteToolOptions = {
  tool: Tool;
  actionType: 'test' | 'run';
  payload?: string;
  attachments?: ExecutionAttachment[];
  timeoutMs?: number;
  retryPolicy?: Partial<PipelineRetryPolicy>;
  signal?: AbortSignal;
  stream?: boolean;
  registry?: AdapterResolver;
};

type QueueListener = (state: ExecutionQueueState) => void;

const TIMEOUT_MESSAGE = 'Execution timed out.';
const CANCELLED_MESSAGE = 'Execution cancelled.';
const DEFAULT_RETRYABLE_STATUS_CODES = [408, 425, 429, 500, 502, 503, 504];

const DEFAULT_PIPELINE_CONFIG: ExecutionPipelineConfig = {
  defaultTimeoutMs: 10_000,
  globalMaxConcurrentRuns: 4,
  defaultRetryPolicy: {
    maxRetries: 0,
    backoffMs: 250,
    backoffMultiplier: 2,
    maxBackoffMs: 5_000,
    retryableStatusCodes: DEFAULT_RETRYABLE_STATUS_CODES,
  },
};

let pipelineConfig: ExecutionPipelineConfig = JSON.parse(JSON.stringify(DEFAULT_PIPELINE_CONFIG)) as ExecutionPipelineConfig;

const now = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
};

const safeClone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

type Waiter = {
  resolve: (release: () => void) => void;
  reject: (reason?: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
};

class Semaphore {
  private current = 0;
  private limit: number;
  private readonly waiters: Waiter[] = [];

  constructor(limit: number) {
    this.limit = Math.max(1, Math.trunc(limit));
  }

  setLimit(limit: number): void {
    this.limit = Math.max(1, Math.trunc(limit));
    this.drain();
  }

  async acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException(CANCELLED_MESSAGE, 'AbortError');
    }

    if (this.current < this.limit) {
      this.current += 1;
      return this.createRelease();
    }

    return new Promise<() => void>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject, signal };

      if (signal) {
        waiter.onAbort = () => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) {
            this.waiters.splice(index, 1);
          }

          signal.removeEventListener('abort', waiter.onAbort!);
          reject(signal.reason ?? new DOMException(CANCELLED_MESSAGE, 'AbortError'));
        };

        signal.addEventListener('abort', waiter.onAbort, { once: true });
      }

      this.waiters.push(waiter);
    });
  }

  private createRelease(): () => void {
    let released = false;

    return () => {
      if (released) {
        return;
      }

      released = true;
      this.current = Math.max(0, this.current - 1);
      this.drain();
    };
  }

  private drain(): void {
    while (this.current < this.limit && this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;

      if (waiter.signal?.aborted) {
        waiter.signal.removeEventListener('abort', waiter.onAbort!);
        waiter.reject(waiter.signal.reason ?? new DOMException(CANCELLED_MESSAGE, 'AbortError'));
        continue;
      }

      if (waiter.signal && waiter.onAbort) {
        waiter.signal.removeEventListener('abort', waiter.onAbort);
      }

      this.current += 1;
      waiter.resolve(this.createRelease());
    }
  }
}

const globalSemaphore = new Semaphore(DEFAULT_PIPELINE_CONFIG.globalMaxConcurrentRuns);
const perToolSemaphores = new Map<string, Semaphore>();

const queueState: ExecutionQueueState = {
  global: { queued: 0, running: 0 },
  tools: {},
};

const queueListeners = new Set<QueueListener>();

const cloneQueueState = (): ExecutionQueueState => {
  return safeClone(queueState);
};

const emitQueueState = (): void => {
  const snapshot = cloneQueueState();
  queueListeners.forEach((listener) => {
    listener(snapshot);
  });
};

const ensureToolQueueCounters = (toolId: string): { queued: number; running: number } => {
  if (!queueState.tools[toolId]) {
    queueState.tools[toolId] = {
      queued: 0,
      running: 0,
    };
  }

  return queueState.tools[toolId];
};

const cleanupToolQueueCounters = (toolId: string): void => {
  const counters = queueState.tools[toolId];
  if (!counters) {
    return;
  }

  if (counters.queued === 0 && counters.running === 0) {
    delete queueState.tools[toolId];
  }
};

const incrementQueued = (toolId: string): void => {
  const counters = ensureToolQueueCounters(toolId);
  queueState.global.queued += 1;
  counters.queued += 1;
  emitQueueState();
};

const decrementQueued = (toolId: string): void => {
  const counters = ensureToolQueueCounters(toolId);
  queueState.global.queued = Math.max(0, queueState.global.queued - 1);
  counters.queued = Math.max(0, counters.queued - 1);
  cleanupToolQueueCounters(toolId);
  emitQueueState();
};

const incrementRunning = (toolId: string): void => {
  const counters = ensureToolQueueCounters(toolId);
  queueState.global.running += 1;
  counters.running += 1;
  emitQueueState();
};

const decrementRunning = (toolId: string): void => {
  const counters = ensureToolQueueCounters(toolId);
  queueState.global.running = Math.max(0, queueState.global.running - 1);
  counters.running = Math.max(0, counters.running - 1);
  cleanupToolQueueCounters(toolId);
  emitQueueState();
};

const getPerToolSemaphore = (toolId: string, limit: number): Semaphore => {
  const current = perToolSemaphores.get(toolId);
  if (current) {
    current.setLimit(limit);
    return current;
  }

  const next = new Semaphore(limit);
  perToolSemaphores.set(toolId, next);
  return next;
};

const acquireExecutionSlots = async (
  tool: Tool,
  signal?: AbortSignal,
): Promise<() => void> => {
  incrementQueued(tool.id);

  let releaseGlobal: (() => void) | null = null;
  let releasePerTool: (() => void) | null = null;

  try {
    releaseGlobal = await globalSemaphore.acquire(signal);

    const perToolLimit = tool.executionPolicy?.concurrency?.maxConcurrentRuns;
    if (perToolLimit && perToolLimit > 0) {
      releasePerTool = await getPerToolSemaphore(tool.id, perToolLimit).acquire(signal);
    }
  } catch (error) {
    decrementQueued(tool.id);
    releaseGlobal?.();
    throw error;
  }

  decrementQueued(tool.id);
  incrementRunning(tool.id);

  return () => {
    decrementRunning(tool.id);
    releasePerTool?.();
    releaseGlobal?.();
  };
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

const isTimeoutAbortReason = (reason: unknown): boolean => {
  if (reason instanceof DOMException) {
    return reason.message === TIMEOUT_MESSAGE;
  }

  if (typeof reason === 'string') {
    return reason.toLowerCase().includes('timed out');
  }

  return false;
};

const isTimeoutError = (message: string): boolean => {
  const lowered = message.toLowerCase();
  return lowered.includes('timed out') || lowered.includes('aborterror');
};

const resolveExecutionError = (error: unknown, signal?: AbortSignal): ToolExecutionError => {
  const parsed = toErrorDetails(error);

  if (signal?.aborted) {
    const timedOut = isTimeoutAbortReason(signal.reason) || isTimeoutError(parsed.message);

    return {
      code: timedOut ? 'timeout' : 'cancelled',
      message: timedOut ? TIMEOUT_MESSAGE : CANCELLED_MESSAGE,
      details: parsed.details,
      stack: parsed.stack,
    };
  }

  const timedOut = isTimeoutError(parsed.message);
  return {
    code: timedOut ? 'timeout' : 'execution_error',
    message: timedOut ? TIMEOUT_MESSAGE : parsed.message,
    details: parsed.details,
    stack: parsed.stack,
  };
};

const resolveAuthHeaders = async (tool: Tool): Promise<Record<string, string>> => {
  if (tool.authType === 'none') {
    return {};
  }

  if (!tool.credentialRefId) {
    throw new Error('Credential reference is missing.');
  }

  const secretVault = createSecretVault();
  const secretValue = await secretVault.getSecret(tool.credentialRefId);
  await updateCredentialLastUsed(tool.credentialRefId, Date.now());

  if (tool.authType === 'bearer') {
    return {
      Authorization: `Bearer ${secretValue}`,
    };
  }

  if (tool.authType === 'custom_header') {
    if (!tool.customHeaderName) {
      throw new Error('Custom header name is missing.');
    }

    return {
      [tool.customHeaderName]: secretValue,
    };
  }

  return {
    [tool.customHeaderName || 'X-API-Key']: secretValue,
  };
};

const sleep = async (durationMs: number, signal?: AbortSignal): Promise<void> => {
  if (durationMs <= 0) {
    return;
  }

  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException(CANCELLED_MESSAGE, 'AbortError'));
      return;
    }

    const handle = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, durationMs);

    const onAbort = (): void => {
      globalThis.clearTimeout(handle);
      signal?.removeEventListener('abort', onAbort);
      reject(signal?.reason ?? new DOMException(CANCELLED_MESSAGE, 'AbortError'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
};

const createAttemptController = (
  timeoutMs: number,
  upstreamSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } => {
  const controller = new AbortController();

  const onUpstreamAbort = (): void => {
    controller.abort(upstreamSignal?.reason ?? new DOMException(CANCELLED_MESSAGE, 'AbortError'));
  };

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      onUpstreamAbort();
    } else {
      upstreamSignal.addEventListener('abort', onUpstreamAbort, { once: true });
    }
  }

  const timeoutHandle = globalThis.setTimeout(() => {
    controller.abort(new DOMException(TIMEOUT_MESSAGE, 'AbortError'));
  }, timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeoutHandle);
      upstreamSignal?.removeEventListener('abort', onUpstreamAbort);
    },
  };
};

const mergeRetryPolicy = (
  base: PipelineRetryPolicy,
  override?: Partial<PipelineRetryPolicy>,
): PipelineRetryPolicy => {
  const next: PipelineRetryPolicy = {
    ...base,
    ...override,
  };

  next.retryableStatusCodes = override?.retryableStatusCodes
    ? [...override.retryableStatusCodes]
    : [...(base.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS_CODES)];

  return next;
};

const resolveRetryPolicy = (
  tool: Tool,
  override?: Partial<PipelineRetryPolicy>,
): PipelineRetryPolicy => {
  const withGlobalOverride = mergeRetryPolicy(pipelineConfig.defaultRetryPolicy, override);
  const withToolOverride = mergeRetryPolicy(withGlobalOverride, tool.executionPolicy?.retry);

  return {
    ...withToolOverride,
    maxRetries: Math.max(0, Math.trunc(withToolOverride.maxRetries)),
    backoffMs: Math.max(0, Math.trunc(withToolOverride.backoffMs)),
    backoffMultiplier: Math.max(1, withToolOverride.backoffMultiplier || 1),
    maxBackoffMs:
      typeof withToolOverride.maxBackoffMs === 'number'
        ? Math.max(0, Math.trunc(withToolOverride.maxBackoffMs))
        : undefined,
    retryableStatusCodes: [...(withToolOverride.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS_CODES)],
  };
};

const computeBackoffMs = (policy: PipelineRetryPolicy, attempt: number): number => {
  const exponent = Math.max(0, attempt);
  const raw = Math.round(policy.backoffMs * Math.pow(policy.backoffMultiplier, exponent));
  const capped = typeof policy.maxBackoffMs === 'number' ? Math.min(raw, policy.maxBackoffMs) : raw;
  return Math.max(0, capped);
};

const isRetryableError = (error: ToolExecutionError): boolean => {
  if (error.code === 'cancelled') {
    return false;
  }

  return error.code === 'timeout' || error.code === 'execution_error';
};

const isRetryableStatusCode = (statusCode: number | null, policy: PipelineRetryPolicy): boolean => {
  if (typeof statusCode !== 'number') {
    return false;
  }

  return (policy.retryableStatusCodes ?? []).includes(statusCode);
};

const resolveTimeoutMs = (tool: Tool, globalTimeoutOverride?: number): number => {
  const fallback = globalTimeoutOverride ?? pipelineConfig.defaultTimeoutMs;
  const perTool = tool.executionPolicy?.timeoutMs;
  const resolved = typeof perTool === 'number' ? perTool : fallback;
  return Math.max(250, Math.trunc(resolved));
};

export const getExecutionPipelineConfig = (): ExecutionPipelineConfig => {
  return safeClone(pipelineConfig);
};

export const setExecutionPipelineConfig = (next: Partial<ExecutionPipelineConfig>): ExecutionPipelineConfig => {
  pipelineConfig = {
    ...pipelineConfig,
    ...next,
    defaultRetryPolicy: mergeRetryPolicy(
      pipelineConfig.defaultRetryPolicy,
      next.defaultRetryPolicy,
    ),
  };

  globalSemaphore.setLimit(pipelineConfig.globalMaxConcurrentRuns);
  return getExecutionPipelineConfig();
};

export const getExecutionQueueState = (): ExecutionQueueState => {
  return cloneQueueState();
};

export const subscribeExecutionQueueState = (listener: QueueListener): (() => void) => {
  queueListeners.add(listener);
  listener(cloneQueueState());

  return () => {
    queueListeners.delete(listener);
  };
};

export const executeToolWithPipelineStream = async function* ({
  tool,
  actionType,
  payload,
  attachments = [],
  timeoutMs,
  retryPolicy,
  signal,
  stream = false,
  registry = toolAdapterRegistry,
}: ExecuteToolOptions): AsyncGenerator<ExecutionEvent, ExecutionResult, void> {
  const adapter = registry.get(tool.type);
  const start = now();

  if (!adapter) {
    const error: ToolExecutionError = {
      code: 'adapter_not_found',
      message: `No adapter registered for tool type: ${tool.type}`,
      details: `Missing adapter registration for ${tool.type}`,
    };
    const result: ExecutionResult = {
      ok: false,
      actionType,
      toolType: tool.type,
      request: null,
      requestSummary: '',
      responseSummary: '',
      durationMs: 0,
      error,
    };

    yield { type: 'error', error };
    yield { type: 'result', result };
    return result;
  }

  yield {
    type: 'status',
    phase: 'validating_config',
    message: 'Validating tool configuration.',
  };

  const validationErrors = adapter.validateConfig(tool, actionType);
  if (validationErrors.length > 0) {
    const error: ToolExecutionError = {
      code: 'invalid_tool_configuration',
      message: 'Tool configuration is invalid.',
      details: validationErrors.join(' '),
    };
    const result: ExecutionResult = {
      ok: false,
      actionType,
      toolType: tool.type,
      request: null,
      requestSummary: '',
      responseSummary: '',
      durationMs: Math.round(now() - start),
      error,
    };

    yield { type: 'error', error };
    yield { type: 'result', result };
    return result;
  }

  let requestSummary = '';
  let request: ReturnType<typeof adapter.buildRequest> | null = null;
  let releaseSlots: (() => void) | null = null;

  try {
    yield {
      type: 'status',
      phase: 'building_request',
      message: 'Building execution request.',
    };

    if (attachments.length > 0 && !adapter.capabilities.supportsFiles) {
      yield {
        type: 'status',
        phase: 'building_request',
        message: 'Selected files ignored: adapter does not support file attachments.',
      };
    }

    const builtRequest = adapter.buildRequest({
      tool,
      actionType,
      payload,
      attachments: adapter.capabilities.supportsFiles ? attachments : [],
    });
    const authHeaders = await resolveAuthHeaders(tool);
    request = {
      ...builtRequest,
      headers: {
        ...builtRequest.headers,
        ...authHeaders,
      },
    };
    requestSummary = createRequestSummary(request);

    yield {
      type: 'status',
      phase: 'queued',
      message: 'Queued for execution.',
    };

    releaseSlots = await acquireExecutionSlots(tool, signal);

    yield {
      type: 'status',
      phase: 'running',
      message: 'Execution slot acquired.',
    };

    const resolvedTimeoutMs = resolveTimeoutMs(tool, timeoutMs);
    const resolvedRetryPolicy = resolveRetryPolicy(tool, retryPolicy);
    const shouldUseStreaming =
      stream && adapter.capabilities.supportsStreaming === true && typeof adapter.executeStream === 'function';

    let attempt = 0;

    while (attempt <= resolvedRetryPolicy.maxRetries) {
      const attemptController = createAttemptController(resolvedTimeoutMs, signal);

      try {
        yield {
          type: 'status',
          phase: 'executing',
          message:
            attempt === 0
              ? 'Executing request.'
              : `Retrying execution (${attempt}/${resolvedRetryPolicy.maxRetries}).`,
        };

        let rawResponse: Awaited<ReturnType<typeof adapter.execute>> | null = null;

        if (shouldUseStreaming && adapter.executeStream) {
          const iterator = adapter.executeStream(request, {
            actionType,
            signal: attemptController.signal,
            timeoutMs: resolvedTimeoutMs,
          })[Symbol.asyncIterator]();

          while (true) {
            const next = await iterator.next();

            if (next.done) {
              rawResponse = next.value ?? null;
              break;
            }

            if (next.value.type === 'result') {
              yield next.value;
              return next.value.result;
            }

            if (next.value.type === 'error') {
              throw new Error(next.value.error.details || next.value.error.message);
            }

            yield next.value;
          }
        }

        if (!rawResponse) {
          rawResponse = await adapter.execute(request, {
            actionType,
            signal: attemptController.signal,
            timeoutMs: resolvedTimeoutMs,
          });
        }

        if (isRetryableStatusCode(rawResponse.statusCode, resolvedRetryPolicy) && attempt < resolvedRetryPolicy.maxRetries) {
          const backoffMs = computeBackoffMs(resolvedRetryPolicy, attempt);
          yield {
            type: 'status',
            phase: 'executing',
            message: `Retryable status ${rawResponse.statusCode}. Retrying in ${backoffMs}ms.`,
          };
          await sleep(backoffMs, signal);
          attempt += 1;
          continue;
        }

        yield {
          type: 'status',
          phase: 'normalizing_response',
          message: 'Normalizing execution response.',
        };

        const normalized = adapter.normalizeResponse(rawResponse, request);
        const durationMs = Math.round(now() - start);
        const result: ExecutionResult = {
          ok: true,
          actionType,
          toolType: tool.type,
          request,
          response: normalized,
          requestSummary,
          responseSummary: `${normalized.statusCode ?? 'n/a'} ${previewText(normalized.bodyPreview)}`,
          durationMs,
        };

        yield {
          type: 'status',
          phase: 'completed',
          message: 'Execution completed.',
        };
        yield { type: 'result', result };
        return result;
      } catch (error) {
        const executionError = resolveExecutionError(error, attemptController.signal);

        if (isRetryableError(executionError) && attempt < resolvedRetryPolicy.maxRetries) {
          const backoffMs = computeBackoffMs(resolvedRetryPolicy, attempt);
          yield {
            type: 'status',
            phase: 'executing',
            message: `Retryable error (${executionError.code}). Retrying in ${backoffMs}ms.`,
          };
          await sleep(backoffMs, signal);
          attempt += 1;
          continue;
        }

        const durationMs = Math.round(now() - start);
        const result: ExecutionResult = {
          ok: false,
          actionType,
          toolType: tool.type,
          request,
          requestSummary,
          responseSummary: '',
          durationMs,
          error: executionError,
        };

        if (executionError.code === 'timeout' || executionError.code === 'cancelled') {
          yield {
            type: 'status',
            phase: 'cancelled',
            message: executionError.message,
          };
        }

        yield { type: 'error', error: executionError };
        yield { type: 'result', result };
        return result;
      } finally {
        attemptController.cleanup();
      }
    }

    const fallbackError: ToolExecutionError = {
      code: 'execution_error',
      message: 'Execution failed after retries.',
      details: 'Pipeline exhausted retries without a terminal result.',
    };
    const fallbackResult: ExecutionResult = {
      ok: false,
      actionType,
      toolType: tool.type,
      request,
      requestSummary,
      responseSummary: '',
      durationMs: Math.round(now() - start),
      error: fallbackError,
    };
    yield { type: 'error', error: fallbackError };
    yield { type: 'result', result: fallbackResult };
    return fallbackResult;
  } catch (error) {
    const executionError = resolveExecutionError(error, signal);
    const durationMs = Math.round(now() - start);
    const result: ExecutionResult = {
      ok: false,
      actionType,
      toolType: tool.type,
      request,
      requestSummary,
      responseSummary: '',
      durationMs,
      error: executionError,
    };

    if (executionError.code === 'timeout' || executionError.code === 'cancelled') {
      yield {
        type: 'status',
        phase: 'cancelled',
        message: executionError.message,
      };
    }

    yield { type: 'error', error: executionError };
    yield { type: 'result', result };
    return result;
  } finally {
    releaseSlots?.();
  }
};

export const executeToolWithPipeline = async (options: ExecuteToolOptions): Promise<ExecutionResult> => {
  const stream = executeToolWithPipelineStream(options);
  const iterator = stream[Symbol.asyncIterator]();

  while (true) {
    const next = await iterator.next();

    if (next.done) {
      return next.value;
    }
  }
};
