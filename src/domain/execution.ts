export type ToolExecutionState = 'queued' | 'running' | 'succeeded' | 'failed';

export type ToolExecutionRecord = {
  id: string;
  toolId: string;
  state: ToolExecutionState;
  message: string;
  startedAt: string;
  finishedAt?: string;
};
