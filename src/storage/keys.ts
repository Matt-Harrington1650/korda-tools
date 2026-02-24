export const STORAGE_KEYS = {
  tools: 'ai-tool-hub/tools',
  settings: 'ai-tool-hub/settings',
  toolRunLogs: 'ai-tool-hub/toolRunLogs',
  credentials: 'ai-tool-hub/credentials',
  workflows: 'ai-tool-hub/workflows',
  workflowRuns: 'ai-tool-hub/workflowRuns',
  workflowNodeRuns: 'ai-tool-hub/workflowNodeRuns',
  schedules: 'ai-tool-hub/schedules',
  scheduledRunLogs: 'ai-tool-hub/scheduledRunLogs',
  chatThreads: 'ai-tool-hub/chatThreads',
} as const;

export type StorageCollectionKey = keyof typeof STORAGE_KEYS;
