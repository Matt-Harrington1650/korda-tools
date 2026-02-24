import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Tool } from '../domain/tool';
import { toolConfigSchemaVersion, toolSchemaVersion } from '../schemas/tool';
import { PluginRegistry } from './PluginRegistry';
import type { PluginManifest } from './PluginManifest';
import { normalizeToolsWithPlugins, validatePluginConfig } from './toolConfig';

const createTool = (overrides: Partial<Tool> = {}): Tool => {
  return {
    id: 'tool-1',
    version: toolSchemaVersion,
    name: 'Plugin Validation Tool',
    description: '',
    category: 'general',
    tags: [],
    type: 'rest_api',
    authType: 'none',
    endpoint: 'https://example.com',
    method: 'GET',
    headers: [],
    samplePayload: '',
    configVersion: toolConfigSchemaVersion,
    config: {
      endpoint: 'https://example.com',
      method: 'GET',
      headers: [],
      samplePayload: '',
    },
    status: 'configured',
    createdAt: '2026-02-24T00:00:00.000Z',
    updatedAt: '2026-02-24T00:00:00.000Z',
    ...overrides,
  };
};

describe('toolConfig plugin helpers', () => {
  it('validates config with plugin schema', () => {
    const errors = validatePluginConfig('rest_api', {
      endpoint: 'not-a-url',
      method: 'GET',
      headers: [],
      samplePayload: '',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('calls plugin migration hook when configVersion is older during load normalization', () => {
    const migrate = vi.fn((oldConfig: unknown, _fromVersion: string) => {
      const current = typeof oldConfig === 'object' && oldConfig !== null ? oldConfig as Record<string, unknown> : {};
      return {
        endpoint: typeof current.endpoint === 'string' ? current.endpoint : 'https://migrated.example.com',
      };
    });

    const manifest: PluginManifest = {
      id: 'test.rest',
      version: '2.0.0',
      displayName: 'Test REST Plugin',
      toolType: 'rest_api',
      capabilities: {
        canTestConnection: true,
        canRun: true,
        supportsHeaders: true,
        supportsPayload: true,
      },
      configSchema: z.object({
        endpoint: z.string().url(),
      }),
      adapterFactory: () => {
        throw new Error('not used in this test');
      },
      migrate,
    };

    const registry = new PluginRegistry();
    registry.register(manifest);

    const source = createTool({
      configVersion: '1.0.0',
      config: {
        endpoint: 'https://legacy.example.com',
      },
    });

    const normalized = normalizeToolsWithPlugins([source], registry);

    expect(migrate).toHaveBeenCalledTimes(1);
    expect(migrate).toHaveBeenCalledWith(
      source.config,
      '1.0.0',
    );
    expect(normalized.changed).toBe(true);
    expect(normalized.tools[0].configVersion).toBe('2.0.0');
  });
});
