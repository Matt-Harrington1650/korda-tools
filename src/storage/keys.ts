export const STORAGE_KEYS = {
  tools: 'ai-tool-hub/tools',
  settings: 'ai-tool-hub/settings',
  toolRunLogs: 'ai-tool-hub/toolRunLogs',
} as const;

export type StorageCollectionKey = keyof typeof STORAGE_KEYS;
