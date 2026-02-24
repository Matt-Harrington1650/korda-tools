import { describe, expect, it } from 'vitest';
import type { ToolAdapter } from '../execution/ToolAdapter';
import { toolSchema } from '../schemas/tool';
import type { PluginManifest } from './PluginManifest';
import { PluginRegistry } from './PluginRegistry';
import { pluginRegistry } from './registry';

const createMockPlugin = (): PluginManifest => {
  const adapter: ToolAdapter = {
    type: 'rest_api',
    capabilities: {
      canTestConnection: true,
      canRun: true,
      supportsHeaders: true,
      supportsPayload: true,
    },
    validateConfig: () => [],
    buildRequest: () => ({
      method: 'GET',
      url: 'https://example.com',
      headers: {},
      body: null,
    }),
    execute: async () => ({
      statusCode: 200,
      headers: {},
      body: 'ok',
    }),
    normalizeResponse: (raw) => ({
      statusCode: raw.statusCode,
      headers: raw.headers,
      body: raw.body,
      bodyPreview: raw.body,
    }),
  };

  return {
    id: 'mock.rest',
    version: '1.0.0',
    displayName: 'Mock REST',
    toolType: 'rest_api',
    capabilities: adapter.capabilities,
    configSchema: toolSchema,
    adapterFactory: () => adapter,
  };
};

describe('PluginRegistry', () => {
  it('registers manifests and resolves adapters by tool type', () => {
    const registry = new PluginRegistry();
    const manifest = createMockPlugin();

    registry.register(manifest);

    expect(registry.getManifestById(manifest.id)?.id).toBe(manifest.id);
    expect(registry.getManifestByToolType('rest_api')?.id).toBe(manifest.id);
    expect(registry.get('rest_api')).toBeTruthy();
  });

  it('registers built-in plugins at startup', () => {
    const allManifests = pluginRegistry.listManifests();
    const toolTypes = allManifests.map((manifest) => manifest.toolType).sort();

    expect(allManifests.length).toBeGreaterThanOrEqual(4);
    expect(toolTypes).toContain('rest_api');
    expect(toolTypes).toContain('openai_compatible');
    expect(toolTypes).toContain('webhook');
    expect(toolTypes).toContain('custom_plugin');
  });
});
