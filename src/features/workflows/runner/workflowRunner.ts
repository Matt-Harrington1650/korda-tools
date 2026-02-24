import type { ExecutionResult } from '../../../domain/execution';
import type { Tool } from '../../../domain/tool';
import type { Workflow, WorkflowNodeRun, WorkflowRun, WorkflowStep } from '../../../domain/workflow';
import { executeToolWithPipelineStream } from '../../../execution';
import { createWorkflowNodeRunId, createWorkflowRunId } from '../../../lib/ids';
import { workflowNodeRunSchemaVersion, workflowRunSchemaVersion } from '../../../schemas/workflowSchemas';

type WorkflowRunnerCallbacks = {
  onRunUpsert: (run: WorkflowRun) => void;
  onNodeRunUpsert: (nodeRun: WorkflowNodeRun) => void;
};

type StartLinearWorkflowRunInput = {
  workflow: Workflow;
  defaultTimeoutMs: number;
  resolveTool: (toolId: string) => Tool | undefined;
  callbacks: WorkflowRunnerCallbacks;
};

type StartedWorkflowRun = {
  runId: string;
  completion: Promise<WorkflowRun>;
};

const activeControllers = new Map<string, AbortController>();

const nowIso = (): string => new Date().toISOString();

const durationMs = (startedAtIso: string, finishedAtIso: string): number => {
  const startedAt = Date.parse(startedAtIso);
  const finishedAt = Date.parse(finishedAtIso);
  return Math.max(0, finishedAt - startedAt);
};

const createNodeRunBase = (workflow: Workflow, workflowRunId: string, step: WorkflowStep): WorkflowNodeRun => ({
  id: createWorkflowNodeRunId(),
  version: workflowNodeRunSchemaVersion,
  workflowId: workflow.id,
  workflowRunId,
  workflowStepId: step.id,
  stepName: step.name,
  toolId: step.toolId,
  status: 'queued',
  startedAt: null,
  finishedAt: null,
  durationMs: 0,
  requestSummary: '',
  responseSummary: '',
  output: '',
  errorMessage: '',
});

const createRunBase = (workflow: Workflow, runId: string): WorkflowRun => {
  const startedAt = nowIso();
  return {
    id: runId,
    version: workflowRunSchemaVersion,
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: 'running',
    startedAt,
    finishedAt: null,
    durationMs: 0,
    errorMessage: '',
  };
};

const appendSkippedSteps = (
  workflow: Workflow,
  runId: string,
  steps: WorkflowStep[],
  callbacks: WorkflowRunnerCallbacks,
  reason: string,
): void => {
  for (const step of steps) {
    callbacks.onNodeRunUpsert({
      ...createNodeRunBase(workflow, runId, step),
      status: 'skipped',
      errorMessage: reason,
    });
  }
};

const executeStep = async (
  workflow: Workflow,
  runId: string,
  step: WorkflowStep,
  tool: Tool,
  timeoutMs: number,
  signal: AbortSignal,
  callbacks: WorkflowRunnerCallbacks,
): Promise<ExecutionResult> => {
  const startedAt = nowIso();
  const nodeBase = createNodeRunBase(workflow, runId, step);
  let streamedOutput = '';

  callbacks.onNodeRunUpsert({
    ...nodeBase,
    status: 'running',
    startedAt,
  });

  let finalResult: ExecutionResult | null = null;
  const stream = executeToolWithPipelineStream({
    tool,
    actionType: step.actionType,
    payload: step.payload || undefined,
    timeoutMs,
    signal,
    stream: step.actionType === 'run',
  });

  for await (const event of stream) {
    if (event.type === 'chunk') {
      streamedOutput += event.chunk;
      callbacks.onNodeRunUpsert({
        ...nodeBase,
        status: 'running',
        startedAt,
        output: streamedOutput,
      });
      continue;
    }

    if (event.type === 'result') {
      finalResult = event.result;
    }
  }

  if (!finalResult) {
    throw new Error('Workflow step did not return an execution result.');
  }

  const finishedAt = nowIso();
  const status = finalResult.ok
    ? 'succeeded'
    : finalResult.error.code === 'cancelled'
      ? 'cancelled'
      : 'failed';

  callbacks.onNodeRunUpsert({
    ...nodeBase,
    status,
    startedAt,
    finishedAt,
    durationMs: durationMs(startedAt, finishedAt),
    requestSummary: finalResult.requestSummary,
    responseSummary: finalResult.responseSummary,
    output: streamedOutput.length > 0
      ? streamedOutput
      : finalResult.ok
        ? finalResult.response.bodyPreview
        : `${finalResult.error.message}\n${finalResult.error.details}`,
    errorMessage: finalResult.ok ? '' : finalResult.error.message,
  });

  return finalResult;
};

export const cancelWorkflowRun = (runId: string): boolean => {
  const controller = activeControllers.get(runId);
  if (!controller) {
    return false;
  }

  controller.abort(new DOMException('Workflow run cancelled.', 'AbortError'));
  return true;
};

export const startLinearWorkflowRun = ({
  workflow,
  defaultTimeoutMs,
  resolveTool,
  callbacks,
}: StartLinearWorkflowRunInput): StartedWorkflowRun => {
  const runId = createWorkflowRunId();
  const controller = new AbortController();
  activeControllers.set(runId, controller);

  const runBase = createRunBase(workflow, runId);
  callbacks.onRunUpsert(runBase);

  const completion = (async (): Promise<WorkflowRun> => {
    let failingMessage = '';

    try {
      for (let index = 0; index < workflow.steps.length; index += 1) {
        const step = workflow.steps[index];

        if (controller.signal.aborted) {
          appendSkippedSteps(
            workflow,
            runId,
            workflow.steps.slice(index),
            callbacks,
            'Skipped due to workflow cancellation.',
          );
          break;
        }

        const tool = resolveTool(step.toolId);
        if (!tool) {
          const missingToolMessage = `Tool "${step.toolId}" not found.`;
          callbacks.onNodeRunUpsert({
            ...createNodeRunBase(workflow, runId, step),
            status: 'failed',
            errorMessage: missingToolMessage,
            output: missingToolMessage,
          });

          if (!step.continueOnError) {
            appendSkippedSteps(
              workflow,
              runId,
              workflow.steps.slice(index + 1),
              callbacks,
              'Skipped due to previous step failure.',
            );
            failingMessage = missingToolMessage;
            break;
          }

          continue;
        }

        const result = await executeStep(
          workflow,
          runId,
          step,
          tool,
          defaultTimeoutMs,
          controller.signal,
          callbacks,
        );

        if (!result.ok) {
          if (result.error.code === 'cancelled') {
            appendSkippedSteps(
              workflow,
              runId,
              workflow.steps.slice(index + 1),
              callbacks,
              'Skipped due to workflow cancellation.',
            );
            break;
          }

          if (!step.continueOnError) {
            appendSkippedSteps(
              workflow,
              runId,
              workflow.steps.slice(index + 1),
              callbacks,
              'Skipped due to previous step failure.',
            );
            failingMessage = result.error.message;
            break;
          }
        }
      }

      const finishedAt = nowIso();
      const status = controller.signal.aborted
        ? 'cancelled'
        : failingMessage
          ? 'failed'
          : 'succeeded';

      const completedRun: WorkflowRun = {
        ...runBase,
        status,
        finishedAt,
        durationMs: durationMs(runBase.startedAt, finishedAt),
        errorMessage: status === 'failed' ? failingMessage : '',
      };
      callbacks.onRunUpsert(completedRun);
      return completedRun;
    } catch (error) {
      const finishedAt = nowIso();
      const failedRun: WorkflowRun = {
        ...runBase,
        status: controller.signal.aborted ? 'cancelled' : 'failed',
        finishedAt,
        durationMs: durationMs(runBase.startedAt, finishedAt),
        errorMessage: error instanceof Error ? error.message : String(error),
      };
      callbacks.onRunUpsert(failedRun);
      return failedRun;
    } finally {
      activeControllers.delete(runId);
    }
  })();

  return {
    runId,
    completion,
  };
};
