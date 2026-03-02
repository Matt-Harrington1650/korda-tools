import { AppError } from '../../lib/errors';
import { isTauriRuntime } from '../../lib/runtime';
import { tauriInvoke } from '../../lib/tauri';
import type { ExecutionRequest, RawExecutionResponse } from '../../execution/types';

interface GatewayRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  timeoutMs: number;
  toolType: string | null;
  governanceContext: {
    workspaceId: string;
    projectId: string;
    actorId: string;
    sensitivityLevel: 'Public' | 'Internal' | 'Confidential' | 'Client-Confidential';
    externalAiOverrideId?: string | null;
    providerId?: string | null;
  } | null;
}

interface GatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;

export class GovernedExecutionGateway {
  async execute(request: ExecutionRequest, signal: AbortSignal): Promise<RawExecutionResponse> {
    if (request.url.startsWith('mock://')) {
      await waitWithAbort(120, signal);
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true, source: request.url, method: request.method }),
      };
    }

    if (!isTauriRuntime()) {
      throw new AppError(
        'GOVERNED_EGRESS_TAURI_REQUIRED',
        'Network egress for governed adapters is only permitted through the Tauri execution gateway.',
      );
    }

    if (signal.aborted) {
      throw signal.reason ?? new DOMException('Execution cancelled.', 'AbortError');
    }

    const timeoutMs = clampTimeoutMs(DEFAULT_TIMEOUT_MS);
    const gatewayRequest: GatewayRequest = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      timeoutMs,
      toolType: request.toolType ?? null,
      governanceContext: request.governanceContext ?? null,
    };

    const invokePromise = tauriInvoke<GatewayResponse>('execution_gateway_http_request', {
      request: gatewayRequest,
    });

    const response = (await raceWithAbort(signal, invokePromise)) as GatewayResponse;
    return {
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body,
    };
  }
}

function clampTimeoutMs(timeoutMs: number): number {
  const normalized = Number.isFinite(timeoutMs) ? Math.trunc(timeoutMs) : DEFAULT_TIMEOUT_MS;
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, normalized));
}

async function raceWithAbort<T>(signal: AbortSignal, promise: Promise<T>): Promise<T> {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException('Execution cancelled.', 'AbortError');
  }

  let abortHandler: (() => void) | null = null;

  const abortPromise = new Promise<never>((_resolve, reject) => {
    abortHandler = () => {
      reject(signal.reason ?? new DOMException('Execution cancelled.', 'AbortError'));
    };
    signal.addEventListener('abort', abortHandler, { once: true });
  });

  try {
    return await Promise.race([promise, abortPromise]);
  } finally {
    if (abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
  }
}

async function waitWithAbort(durationMs: number, signal: AbortSignal): Promise<void> {
  await raceWithAbort(
    signal,
    new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, durationMs);
    }),
  );
}

export const governedExecutionGateway = new GovernedExecutionGateway();
