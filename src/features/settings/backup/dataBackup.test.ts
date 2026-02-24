import { describe, expect, it } from 'vitest';
import { toolConfigSchemaVersion, toolSchemaVersion, type Tool } from '../../../schemas/tool';
import { settingsSchemaVersion, type Settings } from '../../../schemas/settingsSchemas';
import { toolRunLogSchemaVersion, type ToolRunLog } from '../../../schemas/logSchemas';
import type { CredentialRef } from '../../../schemas/credentialSchemas';
import { createDataExportPayload, createRestorePayload, serializeDataExportPayload } from './dataBackup';

const baseSettings: Settings = {
  version: settingsSchemaVersion,
  theme: 'system',
  defaultTimeoutMs: 10_000,
  localStoragePath: './local-data',
  providerDefaults: {
    openaiBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  credentialReferences: {
    openaiApiKeyRef: 'OPENAI_API_KEY',
    webhookSecretRef: 'WEBHOOK_SECRET',
    customHeaderRef: 'CUSTOM_HEADER_TOKEN',
  },
  scheduler: {
    enabled: false,
    notificationsEnabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
};

const baseCredentials: CredentialRef[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    provider: 'keyring',
    label: 'Prod API Key',
    createdAt: 1_700_000_000_000,
    lastUsedAt: null,
  },
];

const baseLog: ToolRunLog = {
  id: 'log-1',
  version: toolRunLogSchemaVersion,
  toolId: 'tool-1',
  timestamp: '2026-02-24T00:00:00.000Z',
  actionType: 'run',
  requestSummary: {
    method: 'POST',
    url: 'https://example.com/run',
    headers: {
      Authorization: 'Bearer should-never-export',
    },
    payloadPreview: '{"token":"leaked-token","safe":"ok"}',
  },
  responseSummary: {
    statusCode: 200,
    preview: '{"secret":"response-secret"}',
    durationMs: 120,
  },
  success: true,
  errorDetails: '',
};

describe('dataBackup', () => {
  it('export payload excludes secret fields and redacts secret-like values', () => {
    const toolWithLegacySecret = {
      id: 'tool-1',
      version: toolSchemaVersion,
      name: 'Legacy Tool',
      description: '',
      category: 'general',
      tags: [],
      type: 'rest_api',
      authType: 'api_key',
      credentialRefId: '11111111-1111-4111-8111-111111111111',
      endpoint: 'https://example.com',
      method: 'POST',
      headers: [],
      samplePayload: '',
      configVersion: toolConfigSchemaVersion,
      config: {
        endpoint: 'https://example.com',
        method: 'POST',
        headers: [],
        samplePayload: '',
      },
      status: 'configured',
      createdAt: '2026-02-24T00:00:00.000Z',
      updatedAt: '2026-02-24T00:00:00.000Z',
      apiKey: 'legacy-api-key',
      bearerToken: 'legacy-bearer-token',
    } as unknown as Tool;

    const payload = createDataExportPayload({
      tools: [toolWithLegacySecret],
      settings: baseSettings,
      logs: [baseLog],
      credentials: baseCredentials,
      exportedAt: '2026-02-24T01:00:00.000Z',
    });
    const serialized = serializeDataExportPayload(payload);

    expect(serialized).not.toContain('legacy-api-key');
    expect(serialized).not.toContain('legacy-bearer-token');
    expect(serialized).not.toContain('should-never-export');
    expect(serialized).not.toContain('leaked-token');
    expect(serialized).not.toContain('response-secret');
    expect(serialized).toContain('[REDACTED]');
    expect(serialized).not.toContain('"apiKey"');
    expect(serialized).not.toContain('"bearerToken"');
  });

  it('restore marks tools requiring auth as missing_credentials', () => {
    const payload = createDataExportPayload({
      tools: [
        {
          id: 'tool-none',
          version: toolSchemaVersion,
          name: 'No Auth',
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
        },
        {
          id: 'tool-auth',
          version: toolSchemaVersion,
          name: 'With Auth',
          description: '',
          category: 'general',
          tags: [],
          type: 'rest_api',
          authType: 'bearer',
          credentialRefId: '11111111-1111-4111-8111-111111111111',
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
        },
      ],
      settings: baseSettings,
      logs: [baseLog],
      credentials: baseCredentials,
      exportedAt: '2026-02-24T01:00:00.000Z',
    });

    const restored = createRestorePayload(payload);
    const noAuthTool = restored.tools.find((tool) => tool.id === 'tool-none');
    const authTool = restored.tools.find((tool) => tool.id === 'tool-auth');

    expect(noAuthTool?.status).toBe('configured');
    expect(authTool?.status).toBe('missing_credentials');
  });
});
