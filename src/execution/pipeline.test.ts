import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tool } from '../domain/tool';
import { toolConfigSchemaVersion, toolSchemaVersion } from '../schemas/tool';
import type { ToolAdapter } from './ToolAdapter';
import { ToolAdapterRegistry } from './ToolAdapterRegistry';
import {
  executeToolWithPipeline,
  getExecutionQueueState,
  setExecutionPipelineConfig,
  subscribeExecutionQueueState,
} from './pipeline';

const createTool = (overrides: Partial<Tool> = {}): Tool => {
  return {
    id: 'tool-1',
    version: toolSchemaVersion,
    name: 'Pipeline Test Tool',
    description: '',
    category: 'general',
    tags: [],
    type: 'custom_plugin',
    authType: 'none',
    endpoint: 'https://example.com/execute',
    method: 'POST',
    headers: [],
    samplePayload: '{"hello":"world"}',
    configVersion: toolConfigSchemaVersion,
    config: {
      endpoint: 'https://example.com/execute',
      samplePayload: '{"hello":"world"}',
    },
    status: 'configured',
    createdAt: '2026-02-24T00:00:00.000Z',
    updatedAt: '2026-02-24T00:00:00.000Z',
    ...overrides,
  };
};

const createRegistry = (adapter: ToolAdapter): ToolAdapterRegistry => {
  const registry = new ToolAdapterRegistry();
  registry.register(adapter);
  return registry;
};

const createBaseAdapter = (execute: ToolAdapter['execute']): ToolAdapter => {
  return {
    type: 'custom_plugin',
    capabilities: {
      canTestConnection: true,
      canRun: true,
      supportsHeaders: false,
      supportsPayload: true,
      supportsStreaming: false,
    },
    validateConfig: () => [],
    buildRequest: () => ({
      method: 'POST',
      url: 'https://example.com/execute',
      headers: {},
      body: '{}',
    }),
    execute,
    normalizeResponse: (raw) => ({
      statusCode: raw.statusCode,
      headers: raw.headers,
      body: raw.body,
      bodyPreview: raw.body,
    }),
  };
};

beforeEach(() => {
  setExecutionPipelineConfig({
    defaultTimeoutMs: 10_000,
    globalMaxConcurrentRuns: 4,
    defaultRetryPolicy: {
      maxRetries: 0,
      backoffMs: 0,
      backoffMultiplier: 1,
      maxBackoffMs: 0,
      retryableStatusCodes: [408, 425, 429, 500, 502, 503, 504],
    },
  });
});

describe('execution pipeline reliability controls', () => {
  it('retries retryable failures and succeeds within maxRetries', async () => {
    let attempt = 0;
    const execute = vi.fn(async () => {
      attempt += 1;
      if (attempt < 3) {
        throw new Error('Temporary network failure');
      }

      return {
        statusCode: 200,
        headers: {},
        body: '{"ok":true}',
      };
    });

    const tool = createTool({
      executionPolicy: {
        retry: {
          maxRetries: 2,
          backoffMs: 0,
          backoffMultiplier: 1,
          retryableStatusCodes: [500],
        },
      },
    });

    const result = await executeToolWithPipeline({
      tool,
      actionType: 'run',
      timeoutMs: 1_000,
      registry: createRegistry(createBaseAdapter(execute)),
    });

    expect(result.ok).toBe(true);
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('supports cancellation via AbortSignal without retrying', async () => {
    const execute = vi.fn(async (_request, context) => {
      await new Promise<void>((resolve, reject) => {
        const handle = setTimeout(() => {
          resolve();
        }, 200);

        context.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(handle);
            reject(context.signal.reason ?? new DOMException('Execution cancelled.', 'AbortError'));
          },
          { once: true },
        );
      });

      return {
        statusCode: 200,
        headers: {},
        body: '{"ok":true}',
      };
    });

    const controller = new AbortController();
    setTimeout(() => {
      controller.abort(new DOMException('Execution cancelled.', 'AbortError'));
    }, 20);

    const result = await executeToolWithPipeline({
      tool: createTool({
        executionPolicy: {
          retry: {
            maxRetries: 3,
            backoffMs: 0,
            backoffMultiplier: 1,
            retryableStatusCodes: [500],
          },
        },
      }),
      actionType: 'run',
      timeoutMs: 1_000,
      signal: controller.signal,
      registry: createRegistry(createBaseAdapter(execute)),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('cancelled');
    }
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('enforces global concurrency limit and exposes queued/running state', async () => {
    setExecutionPipelineConfig({
      globalMaxConcurrentRuns: 1,
    });

    let active = 0;
    let maxActive = 0;
    let queueSeen = false;

    const unsubscribe = subscribeExecutionQueueState((state) => {
      if (state.global.queued > 0) {
        queueSeen = true;
      }
    });

    const execute = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);

      await new Promise((resolve) => {
        setTimeout(resolve, 80);
      });

      active -= 1;

      return {
        statusCode: 200,
        headers: {},
        body: '{"ok":true}',
      };
    });

    const adapter = createBaseAdapter(execute);
    const registry = createRegistry(adapter);

    const first = executeToolWithPipeline({
      tool: createTool({ id: 'tool-a' }),
      actionType: 'run',
      timeoutMs: 2_000,
      registry,
    });
    const second = executeToolWithPipeline({
      tool: createTool({ id: 'tool-b' }),
      actionType: 'run',
      timeoutMs: 2_000,
      registry,
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    unsubscribe();

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    expect(maxActive).toBe(1);
    expect(queueSeen).toBe(true);
    expect(getExecutionQueueState().global).toEqual({
      queued: 0,
      running: 0,
    });
  });

  it('passes attachments only to adapters that support files', async () => {
    const buildWithFiles = vi.fn(() => ({
      method: 'POST',
      url: 'https://example.com/upload',
      headers: {},
      body: '{}',
    }));
    const fileCapableAdapter: ToolAdapter = {
      type: 'custom_plugin',
      capabilities: {
        canTestConnection: true,
        canRun: true,
        supportsHeaders: false,
        supportsPayload: true,
        supportsFiles: true,
        supportsStreaming: false,
      },
      validateConfig: () => [],
      buildRequest: buildWithFiles,
      execute: async () => ({
        statusCode: 200,
        headers: {},
        body: '{"ok":true}',
      }),
      normalizeResponse: (raw) => ({
        statusCode: raw.statusCode,
        headers: raw.headers,
        body: raw.body,
        bodyPreview: raw.body,
      }),
    };

    const attachments = [
      {
        id: 'file-1',
        name: 'payload.json',
        mimeType: 'application/json',
        size: 12,
        dataBase64: 'eyJvayI6dHJ1ZX0=',
      },
    ];

    await executeToolWithPipeline({
      tool: createTool(),
      actionType: 'run',
      attachments,
      registry: createRegistry(fileCapableAdapter),
    });

    expect(buildWithFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments,
      }),
    );

    const buildWithoutFiles = vi.fn(() => ({
      method: 'POST',
      url: 'https://example.com/execute',
      headers: {},
      body: '{}',
    }));
    const noFileAdapter: ToolAdapter = {
      ...fileCapableAdapter,
      capabilities: {
        ...fileCapableAdapter.capabilities,
        supportsFiles: false,
      },
      buildRequest: buildWithoutFiles,
    };

    await executeToolWithPipeline({
      tool: createTool(),
      actionType: 'run',
      attachments,
      registry: createRegistry(noFileAdapter),
    });

    expect(buildWithoutFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [],
      }),
    );
  });
});
