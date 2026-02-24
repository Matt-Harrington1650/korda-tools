const createEntityId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const createToolId = (): string => createEntityId('tool');
export const createWorkflowId = (): string => createEntityId('workflow');
export const createWorkflowStepId = (): string => createEntityId('workflow-step');
export const createWorkflowRunId = (): string => createEntityId('workflow-run');
export const createWorkflowNodeRunId = (): string => createEntityId('workflow-node-run');
export const createScheduleId = (): string => createEntityId('schedule');
export const createScheduledRunLogId = (): string => createEntityId('scheduled-run-log');
export const createChatThreadId = (): string => createEntityId('chat-thread');
export const createChatMessageId = (): string => createEntityId('chat-message');
export const createChatToolCallId = (): string => createEntityId('chat-tool-call');
