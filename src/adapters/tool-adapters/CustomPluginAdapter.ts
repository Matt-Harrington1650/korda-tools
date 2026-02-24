import type { Tool } from '../../domain/tool';
import type { AdapterTestResult } from './ToolAdapter';

export type CustomPluginAdapterConfig = {
  pluginId: string;
  pluginVersion: string;
};

export const testCustomPluginConnection = async (
  tool: Tool,
  _config: CustomPluginAdapterConfig,
): Promise<AdapterTestResult> => {
  // TODO(extension): load plugin manifests and execution handlers from local plugins.
  const startTime = performance.now();
  await new Promise((resolve) => {
    window.setTimeout(resolve, 150);
  });

  return {
    ok: true,
    message: `Mock plugin check succeeded for ${tool.endpoint}`,
    latencyMs: Math.round(performance.now() - startTime),
  };
};
