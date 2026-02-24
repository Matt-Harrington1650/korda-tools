import type { Tool } from '../domain/tool';
import { httpMethodSchema, toolHeaderSchema } from '../schemas/tool';
import type { PluginRegistry } from './PluginRegistry';
import { pluginRegistry } from './registry';

type ToolLegacyProjection = {
  endpoint: string;
  method: Tool['method'];
  headers: Tool['headers'];
  samplePayload: string;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }

  return {};
};

const toHeaderRows = (value: unknown): Tool['headers'] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }

      const candidate = toolHeaderSchema.safeParse(item);
      return candidate.success ? candidate.data : null;
    })
    .filter((entry): entry is Tool['headers'][number] => entry !== null);
};

const parseVersion = (version: string): number[] => {
  return version
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
};

const compareVersion = (left: string, right: string): number => {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
};

export const createDefaultPluginConfig = (toolType: Tool['type']): Record<string, unknown> => {
  if (toolType === 'rest_api') {
    return {
      endpoint: '',
      method: 'GET',
      headers: [],
      samplePayload: '',
    };
  }

  if (toolType === 'openai_compatible') {
    return {
      endpoint: '',
      headers: [],
      samplePayload: '',
    };
  }

  if (toolType === 'webhook') {
    return {
      endpoint: '',
      method: 'POST',
      headers: [],
      samplePayload: '',
    };
  }

  return {
    endpoint: 'https://plugin.local/placeholder',
    samplePayload: '',
  };
};

export const projectPluginConfigToLegacy = (
  toolType: Tool['type'],
  config: Record<string, unknown>,
): ToolLegacyProjection => {
  const record = toRecord(config);
  const endpoint = typeof record.endpoint === 'string' ? record.endpoint.trim() : '';
  const samplePayload = typeof record.samplePayload === 'string' ? record.samplePayload : '';
  const headers = toHeaderRows(record.headers);

  if (toolType === 'rest_api') {
    const method = httpMethodSchema.safeParse(record.method);
    return {
      endpoint,
      method: method.success ? method.data : 'GET',
      headers,
      samplePayload,
    };
  }

  if (toolType === 'webhook') {
    const method = httpMethodSchema.safeParse(record.method);
    return {
      endpoint,
      method: method.success ? method.data : 'POST',
      headers,
      samplePayload,
    };
  }

  if (toolType === 'openai_compatible') {
    return {
      endpoint,
      method: null,
      headers,
      samplePayload,
    };
  }

  return {
    endpoint: endpoint || 'https://plugin.local/placeholder',
    method: null,
    headers,
    samplePayload,
  };
};

export const mapLegacyToolToPluginConfig = (tool: Tool): Record<string, unknown> => {
  const headers = Array.isArray(tool.headers) ? tool.headers : [];
  const samplePayload = typeof tool.samplePayload === 'string' ? tool.samplePayload : '';

  if (tool.type === 'rest_api') {
    return {
      endpoint: tool.endpoint,
      method: tool.method ?? 'GET',
      headers,
      samplePayload,
    };
  }

  if (tool.type === 'openai_compatible') {
    return {
      endpoint: tool.endpoint,
      headers,
      samplePayload,
    };
  }

  if (tool.type === 'webhook') {
    return {
      endpoint: tool.endpoint,
      method: tool.method ?? 'POST',
      headers,
      samplePayload,
    };
  }

  return {
    endpoint: tool.endpoint || 'https://plugin.local/placeholder',
    samplePayload,
  };
};

const areSame = (left: unknown, right: unknown): boolean => {
  return JSON.stringify(left) === JSON.stringify(right);
};

export const validatePluginConfig = (
  toolType: Tool['type'],
  config: Record<string, unknown>,
  registry: PluginRegistry = pluginRegistry,
): string[] => {
  const manifest = registry.getManifestByToolType(toolType);
  if (!manifest) {
    return [`No plugin manifest found for tool type "${toolType}".`];
  }

  const result = manifest.configSchema.safeParse(config);
  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
  });
};

export const normalizeToolWithPlugin = (
  tool: Tool,
  registry: PluginRegistry = pluginRegistry,
): { tool: Tool; changed: boolean } => {
  const manifest = registry.getManifestByToolType(tool.type);
  if (!manifest) {
    return {
      tool,
      changed: false,
    };
  }

  const startingVersion = tool.configVersion || '0.0.0';
  const hasExistingConfig = tool.config && Object.keys(tool.config).length > 0;
  let config = hasExistingConfig ? toRecord(tool.config) : mapLegacyToolToPluginConfig(tool);
  let configVersion = startingVersion;
  let changed = !hasExistingConfig;

  if (compareVersion(configVersion, manifest.version) < 0) {
    if (manifest.migrate) {
      config = toRecord(manifest.migrate(config, configVersion));
    }
    configVersion = manifest.version;
    changed = true;
  }

  let parsedConfig = manifest.configSchema.safeParse(config);

  if (!parsedConfig.success) {
    const fallbackConfig = mapLegacyToolToPluginConfig(tool);
    parsedConfig = manifest.configSchema.safeParse(fallbackConfig);
    if (parsedConfig.success) {
      configVersion = manifest.version;
      changed = true;
    } else {
      return {
        tool,
        changed: false,
      };
    }
  }

  const projection = projectPluginConfigToLegacy(tool.type, toRecord(parsedConfig.data));
  const nextTool: Tool = {
    ...tool,
    ...projection,
    configVersion,
    config: toRecord(parsedConfig.data),
  };

  if (!changed) {
    changed =
      !areSame(tool.config, nextTool.config) ||
      tool.configVersion !== nextTool.configVersion ||
      tool.endpoint !== nextTool.endpoint ||
      tool.method !== nextTool.method ||
      !areSame(tool.headers, nextTool.headers) ||
      tool.samplePayload !== nextTool.samplePayload;
  }

  return {
    tool: nextTool,
    changed,
  };
};

export const normalizeToolsWithPlugins = (
  tools: Tool[],
  registry: PluginRegistry = pluginRegistry,
): { tools: Tool[]; changed: boolean } => {
  let changed = false;

  const normalized = tools.map((tool) => {
    const next = normalizeToolWithPlugin(tool, registry);
    if (next.changed) {
      changed = true;
    }
    return next.tool;
  });

  return {
    tools: normalized,
    changed,
  };
};
