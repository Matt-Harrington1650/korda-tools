import type { Tool } from '../../domain/tool';
import type { AdapterTestResult } from './ToolAdapter';

export type OpenAICompatibleAdapterConfig = {
  baseUrl: string;
  model: string;
  apiKeyEnvVar: string;
};

export const testOpenAICompatibleConnection = async (
  tool: Tool,
  _config: OpenAICompatibleAdapterConfig,
): Promise<AdapterTestResult> => {
  // TODO(extension): add first-class tool types for OpenAI-compatible providers.
  const startTime = performance.now();
  await new Promise((resolve) => {
    window.setTimeout(resolve, 150);
  });

  return {
    ok: true,
    message: `Mock OpenAI-compatible check succeeded for ${tool.endpoint}`,
    latencyMs: Math.round(performance.now() - startTime),
  };
};
