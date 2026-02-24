import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tool } from '../../../domain/tool';
import type { Workflow } from '../../../domain/workflow';
import { toolConfigSchemaVersion, toolSchemaVersion } from '../../../schemas/tool';
import { workflowSchemaVersion } from '../../../schemas/workflowSchemas';
import { cancelWorkflowRun, startLinearWorkflowRun } from './workflowRunner';

const { executeToolWithPipelineStreamMock } = vi.hoisted(() => ({
  executeToolWithPipelineStreamMock: vi.fn(),
}));

vi.mock('../../../execution', () => ({
  executeToolWithPipelineStream: executeToolWithPipelineStreamMock,
}));

const createTool = (id: string): Tool => ({
  id,
  version: toolSchemaVersion,
  name: `Tool ${id}`,
  description: '',
  category: 'general',
  tags: [],
  type: 'custom_plugin',
  authType: 'none',
  endpoint: 'https://example.com',
  method: 'POST',
  headers: [],
  samplePayload: '',
  configVersion: toolConfigSchemaVersion,
  config: {
    endpoint: 'https://example.com',
  },
  status: 'configured',
  createdAt: '2026-02-24T00:00:00.000Z',
  updatedAt: '2026-02-24T00:00:00.000Z',
});

const createWorkflow = (): Workflow => ({
  id: 'workflow-1',
  version: workflowSchemaVersion,
  type: 'linear',
  name: 'Test Workflow',
  description: '',
  tags: [],
  steps: [
    {
      id: 'step-1',
      name: 'Step One',
      toolId: 'tool-1',
      actionType: 'run',
      payload: '',
      continueOnError: false,
    },
    {
      id: 'step-2',
      name: 'Step Two',
      toolId: 'tool-2',
      actionType: 'run',
      payload: '',
      continueOnError: false,
    },
  ],
  createdAt: '2026-02-24T00:00:00.000Z',
  updatedAt: '2026-02-24T00:00:00.000Z',
});

describe('workflowRunner', () => {
  beforeEach(() => {
    executeToolWithPipelineStreamMock.mockReset();
  });

  it('runs linear workflow and records step outputs', async () => {
    executeToolWithPipelineStreamMock.mockImplementation(async function* () {
      yield { type: 'chunk', chunk: 'chunk-1' };
      const result = {
        ok: true as const,
        actionType: 'run' as const,
        toolType: 'custom_plugin' as const,
        request: {
          method: 'POST',
          url: 'https://example.com',
          headers: {},
          body: '',
        },
        response: {
          statusCode: 200,
          headers: {},
          body: '{"ok":true}',
          bodyPreview: '{"ok":true}',
        },
        requestSummary: 'POST https://example.com',
        responseSummary: '200 ok',
        durationMs: 10,
      };
      yield { type: 'result', result };
      return result;
    });

    const runs: Array<{ status: string }> = [];
    const nodeRuns: Array<{ status: string; output: string }> = [];
    const workflow = createWorkflow();

    const started = startLinearWorkflowRun({
      workflow,
      defaultTimeoutMs: 1_000,
      resolveTool: (toolId) => createTool(toolId),
      callbacks: {
        onRunUpsert: (run) => {
          runs.push(run);
        },
        onNodeRunUpsert: (nodeRun) => {
          nodeRuns.push(nodeRun);
        },
      },
    });

    const completed = await started.completion;
    expect(completed.status).toBe('succeeded');
    expect(runs.some((run) => run.status === 'running')).toBe(true);
    expect(runs.some((run) => run.status === 'succeeded')).toBe(true);
    expect(nodeRuns.some((node) => node.status === 'running')).toBe(true);
    expect(nodeRuns.some((node) => node.status === 'succeeded')).toBe(true);
    expect(nodeRuns.some((node) => node.output.includes('chunk-1'))).toBe(true);
  });

  it('supports workflow cancellation', async () => {
    executeToolWithPipelineStreamMock.mockImplementation(async function* (input: { signal: AbortSignal }) {
      await new Promise<void>((resolve) => {
        input.signal.addEventListener(
          'abort',
          () => {
            resolve();
          },
          { once: true },
        );
      });

      const result = {
        ok: false as const,
        actionType: 'run' as const,
        toolType: 'custom_plugin' as const,
        request: null,
        requestSummary: '',
        responseSummary: '',
        durationMs: 10,
        error: {
          code: 'cancelled',
          message: 'Cancelled',
          details: 'cancelled',
        },
      };
      yield { type: 'result', result };
      return result;
    });

    const runs: Array<{ status: string }> = [];
    const workflow = createWorkflow();

    const started = startLinearWorkflowRun({
      workflow,
      defaultTimeoutMs: 1_000,
      resolveTool: (toolId) => createTool(toolId),
      callbacks: {
        onRunUpsert: (run) => {
          runs.push(run);
        },
        onNodeRunUpsert: () => {
          // no-op
        },
      },
    });

    expect(cancelWorkflowRun(started.runId)).toBe(true);
    const completed = await started.completion;
    expect(completed.status).toBe('cancelled');
    expect(runs.some((run) => run.status === 'cancelled')).toBe(true);
  });
});
