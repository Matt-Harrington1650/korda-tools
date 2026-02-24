import type { ToolAdapter } from './ToolAdapter';

export const restToolAdapter: ToolAdapter = {
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
