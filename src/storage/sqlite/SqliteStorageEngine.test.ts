// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CredentialRef } from '../../schemas/credentialSchemas';
import { toolRunLogHistorySchema, toolRunLogSchemaVersion, type ToolRunLog } from '../../schemas/logSchemas';
import { toolRegistrySchema, toolRegistrySchemaVersion } from '../../schemas/toolRegistry';
import { settingsSchema, settingsSchemaVersion } from '../../schemas/settingsSchemas';
import { toolConfigSchemaVersion, toolSchemaVersion, type Tool } from '../../schemas/tool';
import { STORAGE_KEYS } from '../keys';

type ToolTableRow = {
  config_json: string;
  updated_at: number;
};

type LogTableRow = {
  id: string;
  tool_id: string;
  ts: number;
  action_type: string;
  success: number;
  request_json: string | null;
  response_json: string | null;
  error_json: string | null;
};

type CredentialTableRow = {
  id: string;
  provider: string;
  label: string;
  created_at: number;
  last_used_at: number | null;
};

const mockState = vi.hoisted(() => {
  const state = {
    toolsTable: [] as ToolTableRow[],
    logsTable: [] as LogTableRow[],
    credentialsTable: [] as CredentialTableRow[],
    settingsJson: null as string | null,
  };

  const executeMock = vi.fn(async (sql: string, params: unknown[] = []) => {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalizedSql === 'begin' || normalizedSql === 'commit' || normalizedSql === 'rollback') {
      return { rowsAffected: 0 };
    }

    if (normalizedSql.startsWith('delete from tools')) {
      state.toolsTable = [];
      return { rowsAffected: 1 };
    }

    if (normalizedSql.includes('insert into tools')) {
      state.toolsTable.push({
        config_json: String(params[5]),
        updated_at: Number(params[7]),
      });
      return { rowsAffected: 1 };
    }

    if (normalizedSql.startsWith('delete from tool_run_logs')) {
      state.logsTable = [];
      return { rowsAffected: 1 };
    }

    if (normalizedSql.includes('insert into tool_run_logs')) {
      state.logsTable.push({
        id: String(params[0]),
        tool_id: String(params[1]),
        ts: Number(params[2]),
        action_type: String(params[3]),
        success: Number(params[4]),
        request_json: params[5] === null ? null : String(params[5]),
        response_json: params[6] === null ? null : String(params[6]),
        error_json: params[7] === null ? null : String(params[7]),
      });
      return { rowsAffected: 1 };
    }

    if (normalizedSql.includes('insert into settings')) {
      state.settingsJson = String(params[1]);
      return { rowsAffected: 1 };
    }

    if (normalizedSql.includes('insert into credentials')) {
      const id = String(params[0]);
      const row: CredentialTableRow = {
        id,
        provider: String(params[1]),
        label: String(params[2]),
        created_at: Number(params[3]),
        last_used_at: params[4] === null ? null : Number(params[4]),
      };
      const existingIndex = state.credentialsTable.findIndex((entry) => entry.id === id);

      if (existingIndex >= 0) {
        state.credentialsTable[existingIndex] = row;
      } else {
        state.credentialsTable.push(row);
      }

      return { rowsAffected: 1 };
    }

    if (normalizedSql.includes('update credentials')) {
      const id = String(params[0]);
      const nextLastUsedAt = params[1] === null ? null : Number(params[1]);
      state.credentialsTable = state.credentialsTable.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              last_used_at: nextLastUsedAt,
            }
          : entry,
      );
      return { rowsAffected: 1 };
    }

    if (normalizedSql.startsWith('delete from credentials')) {
      const id = String(params[0]);
      state.credentialsTable = state.credentialsTable.filter((entry) => entry.id !== id);
      return { rowsAffected: 1 };
    }

    return { rowsAffected: 0 };
  });

  const selectMock = vi.fn(async (sql: string, params: unknown[] = []) => {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalizedSql.includes('from tools')) {
      return [...state.toolsTable]
        .sort((a, b) => b.updated_at - a.updated_at)
        .map((row) => ({ config_json: row.config_json }));
    }

    if (normalizedSql.includes('from settings')) {
      if (!state.settingsJson) {
        return [];
      }

      return [{ settings_json: state.settingsJson }];
    }

    if (normalizedSql.includes('from tool_run_logs') && normalizedSql.includes('where tool_id = $1')) {
      const toolId = String(params[0]);
      const limit = Number(params[1]);

      return [...state.logsTable]
        .filter((row) => row.tool_id === toolId)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, limit);
    }

    if (normalizedSql.includes('from tool_run_logs')) {
      return [...state.logsTable].sort((a, b) => b.ts - a.ts);
    }

    if (normalizedSql.includes('from credentials')) {
      return [...state.credentialsTable].sort((a, b) => b.created_at - a.created_at);
    }

    return [];
  });

  const loadMock = vi.fn(async () => ({
    execute: executeMock,
    select: selectMock,
  }));

  return {
    state,
    executeMock,
    selectMock,
    loadMock,
  };
});

vi.mock('@tauri-apps/plugin-sql', () => {
  return {
    default: {
      load: mockState.loadMock,
    },
  };
});

vi.mock('../../desktop/sqlite/factory', async () => {
  return {
    createSqliteClient: () => ({
      execute: mockState.executeMock,
      select: mockState.selectMock,
    }),
  };
});

const flushTasks = async (): Promise<void> => {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
};

const loadEngineFactory = async () => {
  const module = await import('./SqliteStorageEngine');
  return module.createSqliteStorageEngine;
};

const createTool = (id: string, updatedAt: string): Tool => {
  return {
    id,
    version: toolSchemaVersion,
    name: `Tool ${id}`,
    description: '',
    category: 'general',
    tags: ['demo'],
    type: 'rest_api',
    authType: 'none',
    endpoint: 'https://example.com/api',
    method: 'GET',
    headers: [],
    samplePayload: '',
    configVersion: toolConfigSchemaVersion,
    config: {
      endpoint: 'https://example.com/api',
      method: 'GET',
      headers: [],
      samplePayload: '',
    },
    status: 'configured',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt,
  };
};

const createLog = (id: string, toolId: string, ts: string): ToolRunLog => {
  return {
    id,
    version: toolRunLogSchemaVersion,
    toolId,
    timestamp: ts,
    actionType: 'run',
    requestSummary: {
      method: 'GET',
      url: 'https://example.com/api',
      headers: {},
      payloadPreview: '',
    },
    responseSummary: {
      statusCode: 200,
      preview: 'ok',
      durationMs: 10,
    },
    success: true,
    errorDetails: '',
  };
};

const createCredential = (id: string, createdAt: number): CredentialRef => {
  return {
    id,
    provider: 'keyring',
    label: `Credential ${id.slice(0, 8)}`,
    createdAt,
    lastUsedAt: null,
  };
};

describe('SqliteStorageEngine', () => {
  beforeEach(() => {
    mockState.state.toolsTable = [];
    mockState.state.logsTable = [];
    mockState.state.credentialsTable = [];
    mockState.state.settingsJson = null;
    mockState.executeMock.mockClear();
    mockState.selectMock.mockClear();
    mockState.loadMock.mockClear();
    window.localStorage.clear();
  });

  it('round-trips tools through save/load with mocked SQLite', async () => {
    const createSqliteStorageEngine = await loadEngineFactory();

    const engine = createSqliteStorageEngine({
      key: STORAGE_KEYS.tools,
      schema: toolRegistrySchema,
      defaultValue: {
        version: toolRegistrySchemaVersion,
        tools: [],
      },
    });

    engine.save({
      version: toolRegistrySchemaVersion,
      tools: [
        createTool('tool-1', '2026-02-10T00:00:00.000Z'),
        createTool('tool-2', '2026-02-11T00:00:00.000Z'),
      ],
    });

    await flushTasks();

    const secondEngine = createSqliteStorageEngine({
      key: STORAGE_KEYS.tools,
      schema: toolRegistrySchema,
      defaultValue: {
        version: toolRegistrySchemaVersion,
        tools: [],
      },
    });

    const loaded = await secondEngine.loadAsync();
    expect(loaded.tools).toHaveLength(2);
    expect(loaded.tools.map((tool) => tool.id).sort()).toEqual(['tool-1', 'tool-2']);
    expect(mockState.selectMock).toHaveBeenCalled();
  });

  it('queries logs by toolId with SQL limit', async () => {
    const createSqliteStorageEngine = await loadEngineFactory();

    const engine = createSqliteStorageEngine({
      key: STORAGE_KEYS.toolRunLogs,
      schema: toolRunLogHistorySchema,
      defaultValue: {
        version: toolRunLogSchemaVersion,
        entries: [],
      },
    });

    engine.save({
      version: toolRunLogSchemaVersion,
      entries: [
        createLog('log-1', 'tool-a', '2026-02-01T00:00:00.000Z'),
        createLog('log-2', 'tool-b', '2026-02-02T00:00:00.000Z'),
        createLog('log-3', 'tool-a', '2026-02-03T00:00:00.000Z'),
      ],
    });

    await flushTasks();

    const rows = await engine.getRunLogsByToolId('tool-a', 1);
    expect(rows).toHaveLength(1);
    expect(rows[0].toolId).toBe('tool-a');
    expect(rows[0].id).toBe('log-3');

    const selectCall = mockState.selectMock.mock.calls.find(([sql]) =>
      String(sql).toLowerCase().includes('where tool_id = $1'),
    );
    expect(selectCall).toBeDefined();
    expect(selectCall?.[1]).toEqual(['tool-a', 1]);
  });

  it('ignores invalid persisted tool rows at the Zod boundary', async () => {
    const createSqliteStorageEngine = await loadEngineFactory();

    const validTool = createTool('valid-tool', '2026-02-11T00:00:00.000Z');
    mockState.state.toolsTable = [
      {
        config_json: JSON.stringify(validTool),
        updated_at: Date.parse(validTool.updatedAt),
      },
      {
        config_json: '{bad-json',
        updated_at: Date.parse('2026-02-12T00:00:00.000Z'),
      },
      {
        config_json: JSON.stringify({
          id: 'missing-fields',
        }),
        updated_at: Date.parse('2026-02-13T00:00:00.000Z'),
      },
    ];

    const engine = createSqliteStorageEngine({
      key: STORAGE_KEYS.tools,
      schema: toolRegistrySchema,
      defaultValue: {
        version: toolRegistrySchemaVersion,
        tools: [],
      },
    });

    const loaded = await engine.loadAsync();
    expect(loaded.tools).toHaveLength(1);
    expect(loaded.tools[0].id).toBe('valid-tool');
  });

  it('loads default settings when settings row is invalid', async () => {
    const createSqliteStorageEngine = await loadEngineFactory();

    mockState.state.settingsJson = '{"version":999}';

    const defaultSettings = {
      version: settingsSchemaVersion,
      theme: 'system' as const,
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

    const engine = createSqliteStorageEngine({
      key: STORAGE_KEYS.settings,
      schema: settingsSchema,
      defaultValue: defaultSettings,
    });

    const loaded = await engine.loadAsync();
    expect(loaded).toEqual(defaultSettings);
  });

  it('wires plugin-sql load/select/execute through TauriSqliteClient', async () => {
    const { TauriSqliteClient } = await import('../../desktop/sqlite/TauriSqliteClient');
    const client = new TauriSqliteClient();

    await client.execute('DELETE FROM tools');
    await client.select('SELECT config_json FROM tools');

    expect(mockState.loadMock).toHaveBeenCalled();
    expect(mockState.executeMock).toHaveBeenCalled();
    expect(mockState.selectMock).toHaveBeenCalled();
  });

  it('supports credential metadata CRUD without storing secrets', async () => {
    const createSqliteStorageEngine = await loadEngineFactory();

    const engine = createSqliteStorageEngine({
      key: STORAGE_KEYS.tools,
      schema: toolRegistrySchema,
      defaultValue: {
        version: toolRegistrySchemaVersion,
        tools: [],
      },
    });

    const first = createCredential('11111111-1111-4111-8111-111111111111', 1_700_000_001_000);
    const second = createCredential('22222222-2222-4222-8222-222222222222', 1_700_000_002_000);

    await engine.createCredential(first);
    await engine.createCredential(second);

    let credentials = await engine.listCredentials();
    expect(credentials).toHaveLength(2);
    expect(credentials[0].id).toBe(second.id);
    expect(credentials[1].id).toBe(first.id);

    await engine.updateCredentialLastUsed(first.id, 1_700_000_100_000);
    credentials = await engine.listCredentials();
    const updated = credentials.find((entry) => entry.id === first.id);
    expect(updated?.lastUsedAt).toBe(1_700_000_100_000);

    await engine.deleteCredential(second.id);
    credentials = await engine.listCredentials();
    expect(credentials.map((entry) => entry.id)).toEqual([first.id]);

    const credentialQueries = mockState.executeMock.mock.calls
      .map(([sql]) => String(sql).toLowerCase())
      .filter((sql) => sql.includes('credentials'));
    expect(credentialQueries.length).toBeGreaterThan(0);
    expect(credentialQueries.every((sql) => !sql.includes('secret'))).toBe(true);
  });
});
