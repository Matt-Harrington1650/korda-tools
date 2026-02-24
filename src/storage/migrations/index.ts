import { settingsSchemaVersion } from '../../schemas/settingsSchemas';
import { toolRunLogSchemaVersion } from '../../schemas/logSchemas';
import { toolSchemaVersion } from '../../schemas/tool';
import { toolRegistrySchemaVersion } from '../../schemas/toolRegistry';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const toStringValue = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

const toSafeUrl = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  try {
    const parsed = new URL(value);
    return parsed.toString();
  } catch {
    return fallback;
  }
};

const mapLegacyToolType = (value: string): 'rest_api' | 'openai_compatible' | 'webhook' | 'custom_plugin' => {
  if (value === 'rest' || value === 'rest_api') {
    return 'rest_api';
  }

  if (value === 'graphql' || value === 'openai_compatible') {
    return 'openai_compatible';
  }

  if (value === 'webhook') {
    return 'webhook';
  }

  return 'custom_plugin';
};

const mapLegacyToolStatus = (value: string): 'configured' | 'missing_credentials' | 'disabled' => {
  if (value === 'healthy' || value === 'configured') {
    return 'configured';
  }

  if (value === 'degraded' || value === 'missing_credentials') {
    return 'missing_credentials';
  }

  return 'disabled';
};

const mapLegacyAuthType = (value: string): 'none' | 'api_key' | 'bearer' | 'custom_header' => {
  if (value === 'api_key' || value === 'bearer' || value === 'custom_header') {
    return value;
  }

  return 'none';
};

const mapLegacyMethod = (value: unknown): 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | null => {
  if (typeof value !== 'string') {
    return null;
  }

  if (value === 'GET' || value === 'POST' || value === 'PUT' || value === 'PATCH' || value === 'DELETE') {
    return value;
  }

  return null;
};

export const migrateTools = (raw: unknown): unknown => {
  if (!isRecord(raw)) {
    return null;
  }

  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version === toolRegistrySchemaVersion) {
    return raw;
  }

  if (version !== 0) {
    return null;
  }

  if (!Array.isArray(raw.tools)) {
    return null;
  }

  const now = new Date().toISOString();
  const migratedTools = raw.tools
    .filter(isRecord)
    .map((legacyTool) => {
      const legacyType = toStringValue(legacyTool.type, 'rest_api');
      const legacyStatus = toStringValue(legacyTool.status, 'configured');
      const endpoint = toStringValue(legacyTool.endpoint) || toStringValue(legacyTool.endpointUrl, 'https://example.com');

      return {
        id: toStringValue(legacyTool.id, `tool-${Math.random().toString(36).slice(2, 10)}`),
        version: toolSchemaVersion,
        name: toStringValue(legacyTool.name, 'Migrated Tool'),
        description: toStringValue(legacyTool.description, ''),
        category: toStringValue(legacyTool.category, 'general'),
        tags: toStringArray(legacyTool.tags),
        type: mapLegacyToolType(legacyType),
        authType: mapLegacyAuthType(toStringValue(legacyTool.authType, 'none')),
        endpoint,
        method: mapLegacyMethod(legacyTool.method),
        headers: Array.isArray(legacyTool.headers)
          ? legacyTool.headers
              .filter(isRecord)
              .map((item) => ({
                key: toStringValue(item.key),
                value: toStringValue(item.value),
              }))
              .filter((item) => item.key.length > 0 && item.value.length > 0)
          : [],
        samplePayload: toStringValue(legacyTool.samplePayload, ''),
        status: mapLegacyToolStatus(legacyStatus),
        createdAt: toStringValue(legacyTool.createdAt, now),
        updatedAt: toStringValue(legacyTool.updatedAt, now),
      };
    });

  return {
    version: toolRegistrySchemaVersion,
    tools: migratedTools,
  };
};

export const migrateSettings = (raw: unknown): unknown => {
  if (!isRecord(raw)) {
    return null;
  }

  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version === settingsSchemaVersion) {
    return raw;
  }

  if (version !== 0) {
    return null;
  }

  const theme = toStringValue(raw.theme, 'system');
  const normalizedTheme = theme === 'light' || theme === 'dark' ? theme : 'system';
  const timeoutCandidate = typeof raw.defaultTimeoutMs === 'number' ? raw.defaultTimeoutMs : 10_000;
  const normalizedTimeout = Number.isFinite(timeoutCandidate)
    ? Math.max(500, Math.min(120_000, Math.round(timeoutCandidate)))
    : 10_000;

  return {
    version: settingsSchemaVersion,
    theme: normalizedTheme,
    defaultTimeoutMs: normalizedTimeout,
    localStoragePath: toStringValue(raw.localStoragePath, './local-data'),
    providerDefaults: {
      openaiBaseUrl: toSafeUrl(raw.openaiBaseUrl, 'https://api.openai.com/v1'),
      defaultModel: toStringValue(raw.defaultModel, 'gpt-4o-mini'),
    },
    credentialReferences: {
      openaiApiKeyRef: toStringValue(raw.openaiApiKeyRef, 'OPENAI_API_KEY'),
      webhookSecretRef: toStringValue(raw.webhookSecretRef, 'WEBHOOK_SECRET'),
      customHeaderRef: toStringValue(raw.customHeaderRef, 'CUSTOM_HEADER_TOKEN'),
    },
  };
};

export const migrateToolRunLogs = (raw: unknown): unknown => {
  if (!isRecord(raw)) {
    return null;
  }

  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version === toolRunLogSchemaVersion) {
    return raw;
  }

  if (version !== 0 || !Array.isArray(raw.entries)) {
    return null;
  }

  const now = new Date().toISOString();

  const entries = raw.entries
    .filter(isRecord)
    .map((legacyEntry, index) => {
      const success = toStringValue(legacyEntry.state) === 'succeeded';
      const requestPayload = toStringValue(legacyEntry.requestPayload);
      const responsePayload = toStringValue(legacyEntry.responsePayload);
      const errorMessage = toStringValue(legacyEntry.errorMessage);

      return {
        id: toStringValue(legacyEntry.id, `log-${index + 1}`),
        version: toolRunLogSchemaVersion,
        toolId: toStringValue(legacyEntry.toolId, 'unknown-tool'),
        timestamp: toStringValue(legacyEntry.finishedAt) || toStringValue(legacyEntry.startedAt, now),
        actionType: 'run',
        requestSummary: {
          method: 'n/a',
          url: 'n/a',
          headers: {},
          payloadPreview: requestPayload,
        },
        responseSummary: {
          statusCode: null,
          preview: responsePayload || errorMessage,
          durationMs: 0,
        },
        success,
        errorDetails: success ? '' : errorMessage || 'Execution failed',
      };
    });

  return {
    version: toolRunLogSchemaVersion,
    entries,
  };
};
