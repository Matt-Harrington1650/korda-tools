import type { ToolType } from '../../domain/tool';
import { restToolAdapter } from './RestToolAdapter';
import type { ToolAdapter } from './ToolAdapter';

const toolAdapters: Partial<Record<ToolType, ToolAdapter>> = {
  rest: restToolAdapter,
};

// TODO(extension): wire adapter registration to plugin/provider manifests.
export const registerToolAdapter = (adapter: ToolAdapter): void => {
  toolAdapters[adapter.type] = adapter;
};

export const getToolAdapter = (type: ToolType): ToolAdapter | null => {
  return toolAdapters[type] ?? null;
};
