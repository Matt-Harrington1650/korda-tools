import { chatThreadSchemaVersion } from '../../schemas/chatSchemas';
import { settingsSchemaVersion } from '../../schemas/settingsSchemas';
import { scheduleSchemaVersion, scheduledRunLogSchemaVersion } from '../../schemas/scheduleSchemas';
import { toolRunLogSchemaVersion } from '../../schemas/logSchemas';
import { toolSchemaVersion } from '../../schemas/tool';
import { toolRegistrySchema, toolRegistrySchemaVersion } from '../../schemas/toolRegistry';
import {
  workflowNodeRunSchemaVersion,
  workflowRunSchemaVersion,
  workflowSchemaVersion,
} from '../../schemas/workflowSchemas';

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

const buildFallbackCredentialRefId = (toolId: string): string => {
  return `cred-${toolId}`;
};

const normalizeCredentialRefId = (value: unknown, toolId: string, authType: ReturnType<typeof mapLegacyAuthType>): string | undefined => {
  const direct = toStringValue(value);
  if (direct.length > 0) {
    return direct;
  }

  if (authType === 'none') {
    return undefined;
  }

  return buildFallbackCredentialRefId(toolId);
};

const resolveCustomHeaderName = (legacyTool: Record<string, unknown>, authType: ReturnType<typeof mapLegacyAuthType>): string | undefined => {
  if (authType !== 'custom_header') {
    return undefined;
  }

  const existing = toStringValue(legacyTool.customHeaderName);
  if (existing.length > 0) {
    return existing;
  }

  const fromHeaders = Array.isArray(legacyTool.headers)
    ? legacyTool.headers
        .filter(isRecord)
        .map((header) => toStringValue(header.key))
        .find((headerKey) => headerKey.length > 0)
    : '';

  return fromHeaders || 'X-Custom-Auth';
};

const normalizeStatusForAuth = (
  status: ReturnType<typeof mapLegacyToolStatus>,
  authType: ReturnType<typeof mapLegacyAuthType>,
  credentialRefId?: string,
): ReturnType<typeof mapLegacyToolStatus> => {
  if (authType === 'none') {
    return status;
  }

  if (!credentialRefId || credentialRefId.trim().length === 0) {
    return 'missing_credentials';
  }

  return status;
};

const normalizeHeaders = (legacyTool: Record<string, unknown>): Array<{ key: string; value: string }> => {
  if (!Array.isArray(legacyTool.headers)) {
    return [];
  }

  return legacyTool.headers
    .filter(isRecord)
    .map((item) => ({
      key: toStringValue(item.key),
      value: toStringValue(item.value),
    }))
    .filter((item) => item.key.length > 0 && item.value.length > 0);
};

const migrateToolRecord = (legacyTool: Record<string, unknown>, now: string) => {
  const toolId = toStringValue(legacyTool.id, `tool-${Math.random().toString(36).slice(2, 10)}`);
  const authType = mapLegacyAuthType(toStringValue(legacyTool.authType, 'none'));
  const legacyType = toStringValue(legacyTool.type, 'rest_api');
  const legacyStatus = mapLegacyToolStatus(toStringValue(legacyTool.status, 'configured'));
  const endpoint = toStringValue(legacyTool.endpoint) || toStringValue(legacyTool.endpointUrl, 'https://example.com');
  const credentialRefId = normalizeCredentialRefId(legacyTool.credentialRefId, toolId, authType);
  const customHeaderName = resolveCustomHeaderName(legacyTool, authType);
  const method = mapLegacyMethod(legacyTool.method);
  const headers = normalizeHeaders(legacyTool);
  const samplePayload = toStringValue(legacyTool.samplePayload, '');
  const toolType = mapLegacyToolType(legacyType);
  const config = (() => {
    if (toolType === 'rest_api') {
      return {
        endpoint,
        method: method ?? 'GET',
        headers,
        samplePayload,
      };
    }

    if (toolType === 'openai_compatible') {
      return {
        endpoint,
        headers,
        samplePayload,
      };
    }

    if (toolType === 'webhook') {
      return {
        endpoint,
        method: method ?? 'POST',
        headers,
        samplePayload,
      };
    }

    return {
      endpoint,
      samplePayload,
    };
  })();

  return {
    id: toolId,
    version: toolSchemaVersion,
    name: toStringValue(legacyTool.name, 'Migrated Tool'),
    description: toStringValue(legacyTool.description, ''),
    category: toStringValue(legacyTool.category, 'general'),
    tags: toStringArray(legacyTool.tags),
    type: toolType,
    authType,
    credentialRefId,
    customHeaderName,
    endpoint,
    method,
    headers,
    samplePayload,
    configVersion: toStringValue(legacyTool.configVersion, '0.0.0'),
    config,
    status: normalizeStatusForAuth(legacyStatus, authType, credentialRefId),
    createdAt: toStringValue(legacyTool.createdAt, now),
    updatedAt: toStringValue(legacyTool.updatedAt, now),
  };
};

export const migrateTools = (raw: unknown): unknown => {
  if (!isRecord(raw)) {
    return null;
  }

  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version === toolRegistrySchemaVersion) {
    const current = toolRegistrySchema.safeParse(raw);
    if (current.success) {
      return raw;
    }
  }

  if (version !== 0 && version !== toolRegistrySchemaVersion) {
    return null;
  }

  if (!Array.isArray(raw.tools)) {
    return null;
  }

  const now = new Date().toISOString();
  const migratedTools = raw.tools.filter(isRecord).map((legacyTool) => migrateToolRecord(legacyTool, now));

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
    scheduler: {
      enabled: false,
      notificationsEnabled: true,
      notifyOnSuccess: false,
      notifyOnFailure: true,
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

export const migrateWorkflows = (raw: unknown): unknown => {
  if (!isRecord(raw)) {
    if (Array.isArray(raw)) {
      return {
        version: workflowSchemaVersion,
        workflows: [],
      };
    }

    return null;
  }

  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version === workflowSchemaVersion) {
    return raw;
  }

  if (version !== 0) {
    return null;
  }

  return {
    version: workflowSchemaVersion,
    workflows: Array.isArray(raw.workflows) ? raw.workflows : [],
  };
};

export const migrateWorkflowRuns = (raw: unknown): unknown => {
  if (!isRecord(raw)) {
    return null;
  }

  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version === workflowRunSchemaVersion) {
    return raw;
  }

  if (version !== 0) {
    return null;
  }

  return {
    version: workflowRunSchemaVersion,
    entries: Array.isArray(raw.entries) ? raw.entries : [],
  };
};

export const migrateWorkflowNodeRuns = (raw: unknown): unknown => {
  if (!isRecord(raw)) {
    return null;
  }

  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version === workflowNodeRunSchemaVersion) {
    return raw;
  }

  if (version !== 0) {
    return null;
  }

  return {
    version: workflowNodeRunSchemaVersion,
    entries: Array.isArray(raw.entries) ? raw.entries : [],
  };
};

export const migrateSchedules = (raw: unknown): unknown => {
  if (!isRecord(raw)) {
    return null;
  }

  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version === scheduleSchemaVersion) {
    return raw;
  }

  if (version !== 0) {
    return null;
  }

  return {
    version: scheduleSchemaVersion,
    schedules: Array.isArray(raw.schedules) ? raw.schedules : [],
  };
};

export const migrateScheduledRunLogs = (raw: unknown): unknown => {
  if (!isRecord(raw)) {
    return null;
  }

  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version === scheduledRunLogSchemaVersion) {
    return raw;
  }

  if (version !== 0) {
    return null;
  }

  return {
    version: scheduledRunLogSchemaVersion,
    entries: Array.isArray(raw.entries) ? raw.entries : [],
  };
};

export const migrateChatThreads = (raw: unknown): unknown => {
  if (!isRecord(raw)) {
    return null;
  }

  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version === chatThreadSchemaVersion) {
    return raw;
  }

  if (version !== 0) {
    return null;
  }

  return {
    version: chatThreadSchemaVersion,
    threads: Array.isArray(raw.threads) ? raw.threads : [],
  };
};
