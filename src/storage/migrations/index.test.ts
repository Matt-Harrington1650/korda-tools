import { describe, expect, it } from 'vitest';
import { chatThreadSchemaVersion } from '../../schemas/chatSchemas';
import { settingsSchemaVersion } from '../../schemas/settingsSchemas';
import { scheduleSchemaVersion, scheduledRunLogSchemaVersion } from '../../schemas/scheduleSchemas';
import { toolRunLogSchemaVersion } from '../../schemas/logSchemas';
import { toolSchemaVersion } from '../../schemas/tool';
import { toolRegistrySchemaVersion } from '../../schemas/toolRegistry';
import {
  workflowNodeRunSchemaVersion,
  workflowRunSchemaVersion,
  workflowSchemaVersion,
} from '../../schemas/workflowSchemas';
import {
  migrateSettings,
  migrateToolRunLogs,
  migrateTools,
  migrateWorkflowNodeRuns,
  migrateWorkflowRuns,
  migrateWorkflows,
  migrateChatThreads,
  migrateSchedules,
  migrateScheduledRunLogs,
} from './index';

describe('migrateTools', () => {
  it('returns current version data unchanged', () => {
    const current = {
      version: toolRegistrySchemaVersion,
      tools: [
        {
          id: 'tool-1',
          version: toolSchemaVersion,
          name: 'Current Tool',
          description: '',
          category: 'general',
          tags: [],
          type: 'rest_api',
          authType: 'none',
          endpoint: 'https://example.com',
          method: 'GET',
          headers: [],
          samplePayload: '',
          status: 'configured',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    };

    expect(migrateTools(current)).toEqual(current);
  });

  it('migrates legacy version 0 tools', () => {
    const legacy = {
      version: 0,
      tools: [
        {
          id: 'legacy-tool',
          name: 'Legacy Tool',
          description: 'legacy',
          type: 'rest',
          endpointUrl: 'https://legacy.example.com',
          status: 'healthy',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    };

    const migrated = migrateTools(legacy) as { version: number; tools: Array<Record<string, unknown>> };

    expect(migrated.version).toBe(toolRegistrySchemaVersion);
    expect(migrated.tools).toHaveLength(1);
    expect(migrated.tools[0].type).toBe('rest_api');
    expect(migrated.tools[0].status).toBe('configured');
    expect(migrated.tools[0].authType).toBe('none');
    expect(migrated.tools[0].endpoint).toBe('https://legacy.example.com');
  });

  it('returns null for malformed or unknown versions', () => {
    expect(migrateTools('bad')).toBeNull();
    expect(migrateTools({ version: 99, tools: [] })).toBeNull();
  });
});

describe('migrateSettings', () => {
  it('returns current version data unchanged', () => {
    const current = {
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
    };

    expect(migrateSettings(current)).toEqual(current);
  });

  it('migrates legacy settings shape to current version', () => {
    const legacy = {
      version: 0,
      theme: 'dark',
      defaultTimeoutMs: 2000,
      localStoragePath: '/tmp/store',
      openaiBaseUrl: 'https://proxy.example.com/v1',
      defaultModel: 'gpt-custom',
      openaiApiKeyRef: 'OPENAI_REF',
      webhookSecretRef: 'WEBHOOK_REF',
      customHeaderRef: 'HEADER_REF',
    };

    const migrated = migrateSettings(legacy) as {
      version: number;
      theme: string;
      defaultTimeoutMs: number;
      providerDefaults: { openaiBaseUrl: string; defaultModel: string };
      credentialReferences: { openaiApiKeyRef: string };
    };

    expect(migrated.version).toBe(settingsSchemaVersion);
    expect(migrated.theme).toBe('dark');
    expect(migrated.defaultTimeoutMs).toBe(2000);
    expect(migrated.providerDefaults.openaiBaseUrl).toBe('https://proxy.example.com/v1');
    expect(migrated.providerDefaults.defaultModel).toBe('gpt-custom');
    expect(migrated.credentialReferences.openaiApiKeyRef).toBe('OPENAI_REF');
  });

  it('returns null for malformed or unknown versions', () => {
    expect(migrateSettings(null)).toBeNull();
    expect(migrateSettings({ version: 77 })).toBeNull();
  });
});

describe('migrateToolRunLogs', () => {
  it('returns current version data unchanged', () => {
    const current = {
      version: toolRunLogSchemaVersion,
      entries: [
        {
          id: 'log-1',
          version: toolRunLogSchemaVersion,
          toolId: 'tool-1',
          timestamp: '2025-01-01T00:00:00.000Z',
          actionType: 'test',
          requestSummary: {
            method: 'GET',
            url: 'https://example.com',
            headers: {},
            payloadPreview: '',
          },
          responseSummary: {
            statusCode: 200,
            preview: 'ok',
            durationMs: 12,
          },
          success: true,
          errorDetails: '',
        },
      ],
    };

    expect(migrateToolRunLogs(current)).toEqual(current);
  });

  it('migrates legacy run logs to current shape', () => {
    const legacy = {
      version: 0,
      entries: [
        {
          id: 'legacy-log',
          toolId: 'tool-2',
          state: 'failed',
          startedAt: '2025-01-01T00:00:00.000Z',
          requestPayload: '{"secret":"abc"}',
          responsePayload: '',
          errorMessage: 'boom',
        },
      ],
    };

    const migrated = migrateToolRunLogs(legacy) as {
      version: number;
      entries: Array<{
        actionType: string;
        success: boolean;
        requestSummary: { payloadPreview: string };
        responseSummary: { preview: string };
        errorDetails: string;
      }>;
    };

    expect(migrated.version).toBe(toolRunLogSchemaVersion);
    expect(migrated.entries).toHaveLength(1);
    expect(migrated.entries[0].actionType).toBe('run');
    expect(migrated.entries[0].success).toBe(false);
    expect(migrated.entries[0].requestSummary.payloadPreview).toContain('secret');
    expect(migrated.entries[0].responseSummary.preview).toBe('boom');
    expect(migrated.entries[0].errorDetails).toBe('boom');
  });

  it('returns null for malformed or unknown versions', () => {
    expect(migrateToolRunLogs({ version: 2, entries: [] })).toBeNull();
    expect(migrateToolRunLogs({ version: 0, entries: 'bad' })).toBeNull();
  });
});

describe('workflow migration helpers', () => {
  it('returns current workflow payload unchanged', () => {
    const current = {
      version: workflowSchemaVersion,
      workflows: [],
    };
    expect(migrateWorkflows(current)).toEqual(current);
  });

  it('returns current workflow run payload unchanged', () => {
    const current = {
      version: workflowRunSchemaVersion,
      entries: [],
    };
    expect(migrateWorkflowRuns(current)).toEqual(current);
  });

  it('returns current workflow node run payload unchanged', () => {
    const current = {
      version: workflowNodeRunSchemaVersion,
      entries: [],
    };
    expect(migrateWorkflowNodeRuns(current)).toEqual(current);
  });

  it('returns current schedule payload unchanged', () => {
    const current = {
      version: scheduleSchemaVersion,
      schedules: [],
    };
    expect(migrateSchedules(current)).toEqual(current);
  });

  it('returns current scheduled run log payload unchanged', () => {
    const current = {
      version: scheduledRunLogSchemaVersion,
      entries: [],
    };
    expect(migrateScheduledRunLogs(current)).toEqual(current);
  });

  it('returns current chat thread payload unchanged', () => {
    const current = {
      version: chatThreadSchemaVersion,
      threads: [],
    };
    expect(migrateChatThreads(current)).toEqual(current);
  });
});
