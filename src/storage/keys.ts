export const STORAGE_KEYS = {
  tools: 'korda-tools/tools',
  settings: 'korda-tools/settings',
  toolRunLogs: 'korda-tools/toolRunLogs',
  credentials: 'korda-tools/credentials',
  workflows: 'korda-tools/workflows',
  workflowRuns: 'korda-tools/workflowRuns',
  workflowNodeRuns: 'korda-tools/workflowNodeRuns',
  schedules: 'korda-tools/schedules',
  scheduledRunLogs: 'korda-tools/scheduledRunLogs',
  chatThreads: 'korda-tools/chatThreads',
} as const;

export type StorageCollectionKey = keyof typeof STORAGE_KEYS;
