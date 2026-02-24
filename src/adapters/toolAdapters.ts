import type { Tool, ToolType } from '../domain/tool';

export type AdapterTestResult = {
  ok: boolean;
  message: string;
  latencyMs: number;
};

export interface ToolExecutionAdapter {
  type: ToolType;
  testConnection: (tool: Tool) => Promise<AdapterTestResult>;
}

const restToolAdapter: ToolExecutionAdapter = {
  type: 'rest',
  testConnection: async (tool) => {
    const startTime = performance.now();
    await new Promise((resolve) => {
      window.setTimeout(resolve, 150);
    });

    return {
      ok: true,
      message: `Mock test succeeded for ${tool.endpoint}`,
      latencyMs: Math.round(performance.now() - startTime),
    };
  },
};

// TODO(extension): register adapters for additional tool/provider types.
const toolAdapters: Partial<Record<ToolType, ToolExecutionAdapter>> = {
  rest: restToolAdapter,
};

export const getToolAdapter = (type: ToolType): ToolExecutionAdapter | null => {
  return toolAdapters[type] ?? null;
};
