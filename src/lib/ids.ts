export const createToolId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};
