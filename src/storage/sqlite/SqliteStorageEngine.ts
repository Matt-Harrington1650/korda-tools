import type { ZodType } from 'zod';
import { createSqliteClient } from '../../desktop/sqlite/factory';
import type { SqliteClient } from '../../desktop/sqlite/SqliteClient';
import { AppError } from '../../lib/errors';
import type { CredentialRef } from '../../schemas/credentialSchemas';
import { credentialRefSchema } from '../../schemas/credentialSchemas';
import { chatThreadSchema, chatThreadSchemaVersion, type ChatThread } from '../../schemas/chatSchemas';
import type { ToolRunLog } from '../../schemas/logSchemas';
import { toolRunActionTypeSchema, toolRunLogSchema } from '../../schemas/logSchemas';
import {
  scheduleSchema,
  scheduleSchemaVersion,
  scheduledRunLogSchema,
  scheduledRunLogSchemaVersion,
  type Schedule,
  type ScheduledRunLog,
} from '../../schemas/scheduleSchemas';
import { settingsSchema } from '../../schemas/settingsSchemas';
import { toolSchema } from '../../schemas/tool';
import {
  workflowNodeRunSchema,
  workflowNodeRunSchemaVersion,
  workflowSchema,
  workflowRunSchema,
  workflowRunSchemaVersion,
  workflowSchemaVersion,
  type Workflow,
  type WorkflowNodeRun,
  type WorkflowRun,
} from '../../schemas/workflowSchemas';
import { STORAGE_KEYS } from '../keys';
import type { StorageEngineOptions } from '../localStorageEngine';
import type { StorageEngine } from '../StorageEngine';

type SqliteStorageEngineOptions<T> = StorageEngineOptions<T>;

type ToolRow = {
  config_json: string;
};

type SettingsRow = {
  settings_json: string;
};

type WorkflowRow = {
  workflow_json: string;
  updated_at: number;
};

type WorkflowRunRow = {
  run_json: string;
  ts: number;
};

type WorkflowNodeRunRow = {
  node_json: string;
  ts: number;
};

type ScheduleRow = {
  schedule_json: string;
  updated_at: number;
};

type ScheduledRunLogRow = {
  log_json: string;
  ts: number;
};

type ChatThreadRow = {
  thread_json: string;
  updated_at: number;
};

type ToolRunLogRow = {
  id: string;
  tool_id: string;
  ts: number;
  action_type: string;
  success: number;
  request_json: string | null;
  response_json: string | null;
  error_json: string | null;
};

type CredentialRow = {
  id: string;
  provider: string;
  label: string;
  created_at: number;
  last_used_at: number | null;
};

const SETTINGS_ROW_ID = 'default';
const MAX_LOG_QUERY_LIMIT = 500;

const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const safeParseJson = (raw: string): unknown | null => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const resolveVersion = (value: unknown, fallback = 1): number => {
  if (isRecord(value) && typeof value.version === 'number') {
    return value.version;
  }

  return fallback;
};

const toEpochMs = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const toIsoString = (value: number): string => {
  const parsed = Number.isFinite(value) ? value : Date.now();
  return new Date(parsed).toISOString();
};

const normalizeLimit = (limit: number): number => {
  if (!Number.isFinite(limit)) {
    return 50;
  }

  return Math.max(1, Math.min(MAX_LOG_QUERY_LIMIT, Math.trunc(limit)));
};

const normalizeRunLogRow = (row: ToolRunLogRow): ToolRunLog | null => {
  const requestSummary = row.request_json ? safeParseJson(row.request_json) : null;
  const responseSummary = row.response_json ? safeParseJson(row.response_json) : null;
  const errorPayload = row.error_json ? safeParseJson(row.error_json) : null;
  const actionType = toolRunActionTypeSchema.safeParse(row.action_type);

  const result = toolRunLogSchema.safeParse({
    id: row.id,
    version: 1,
    toolId: row.tool_id,
    timestamp: toIsoString(row.ts),
    actionType: actionType.success ? actionType.data : 'run',
    requestSummary: isRecord(requestSummary)
      ? requestSummary
      : {
          method: 'n/a',
          url: 'n/a',
          headers: {},
          payloadPreview: '',
        },
    responseSummary: isRecord(responseSummary)
      ? responseSummary
      : {
          statusCode: null,
          preview: '',
          durationMs: 0,
        },
    success: row.success === 1,
    errorDetails: isRecord(errorPayload) && typeof errorPayload.errorDetails === 'string' ? errorPayload.errorDetails : '',
  });

  if (!result.success) {
    return null;
  }

  return result.data;
};

const normalizeCredentialRow = (row: CredentialRow): CredentialRef | null => {
  const result = credentialRefSchema.safeParse({
    id: row.id,
    provider: row.provider,
    label: row.label,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  });

  if (!result.success) {
    return null;
  }

  return result.data;
};

const normalizeWorkflowRow = (row: WorkflowRow): Workflow | null => {
  const parsed = safeParseJson(row.workflow_json);
  const result = workflowSchema.safeParse(parsed);

  if (!result.success) {
    return null;
  }

  return result.data;
};

const normalizeWorkflowRunRow = (row: WorkflowRunRow): WorkflowRun | null => {
  const parsed = safeParseJson(row.run_json);
  const result = workflowRunSchema.safeParse(parsed);

  if (!result.success) {
    return null;
  }

  return result.data;
};

const normalizeWorkflowNodeRunRow = (row: WorkflowNodeRunRow): WorkflowNodeRun | null => {
  const parsed = safeParseJson(row.node_json);
  const result = workflowNodeRunSchema.safeParse(parsed);

  if (!result.success) {
    return null;
  }

  return result.data;
};

const normalizeScheduleRow = (row: ScheduleRow): Schedule | null => {
  const parsed = safeParseJson(row.schedule_json);
  const result = scheduleSchema.safeParse(parsed);

  if (!result.success) {
    return null;
  }

  return result.data;
};

const normalizeScheduledRunLogRow = (row: ScheduledRunLogRow): ScheduledRunLog | null => {
  const parsed = safeParseJson(row.log_json);
  const result = scheduledRunLogSchema.safeParse(parsed);

  if (!result.success) {
    return null;
  }

  return result.data;
};

const normalizeChatThreadRow = (row: ChatThreadRow): ChatThread | null => {
  const parsed = safeParseJson(row.thread_json);
  const result = chatThreadSchema.safeParse(parsed);

  if (!result.success) {
    return null;
  }

  return result.data;
};

type AsyncStorageEngine<T> = StorageEngine<T> & {
  loadAsync: () => Promise<T>;
};

export type SqliteStorageEngine<T> = AsyncStorageEngine<T> & {
  getRunLogsByToolId: (toolId: string, limit: number) => Promise<ToolRunLog[]>;
  listCredentials: () => Promise<CredentialRef[]>;
  createCredential: (ref: CredentialRef) => Promise<void>;
  updateCredentialLastUsed: (id: string, ts: number | null) => Promise<void>;
  deleteCredential: (id: string) => Promise<void>;
};

class SqliteStorageEngineImpl<T> implements SqliteStorageEngine<T> {
  private readonly client: SqliteClient;
  private readonly key: string;
  private readonly schema: ZodType<T>;
  private readonly defaultValue: T;
  private readonly migrate: (raw: unknown) => unknown;
  private readonly mirrorStorage: Storage | null;

  private cache: T;
  private hydrated = false;
  private hydrationPromise: Promise<void> | null = null;
  private writePromise: Promise<void> = Promise.resolve();
  private revision = 0;

  constructor(options: SqliteStorageEngineOptions<T>) {
    this.client = createSqliteClient();
    this.key = options.key;
    this.schema = options.schema;
    this.defaultValue = options.defaultValue;
    this.migrate = options.migrate ?? ((raw) => raw);
    this.mirrorStorage = typeof window === 'undefined' ? null : window.localStorage;
    this.cache = this.loadFromMirror() ?? cloneValue(this.defaultValue);
  }

  load = (): T => {
    this.ensureHydrated();
    return cloneValue(this.cache);
  };

  loadAsync = async (): Promise<T> => {
    this.ensureHydrated();
    if (this.hydrationPromise) {
      await this.hydrationPromise;
    }
    return cloneValue(this.cache);
  };

  save = (value: T): void => {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      return;
    }

    this.revision += 1;
    this.hydrated = true;
    this.cache = parsed.data;
    this.writeToMirror(parsed.data);
    this.enqueueWrite(() => this.persistByKey(parsed.data));
  };

  clear = (): void => {
    this.revision += 1;
    this.hydrated = true;
    this.cache = cloneValue(this.defaultValue);
    this.clearMirror();
    this.enqueueWrite(() => this.clearByKey());
  };

  async getRunLogsByToolId(toolId: string, limit: number): Promise<ToolRunLog[]> {
    if (this.key !== STORAGE_KEYS.toolRunLogs) {
      return [];
    }

    return this.withClient(async (client) => {
      const rows = await client.select<ToolRunLogRow>(
        `
          SELECT id, tool_id, ts, action_type, success, request_json, response_json, error_json
          FROM tool_run_logs
          WHERE tool_id = $1
          ORDER BY ts DESC
          LIMIT $2
        `,
        [toolId, normalizeLimit(limit)],
      );

      return rows
        .map(normalizeRunLogRow)
        .filter((entry): entry is ToolRunLog => entry !== null);
    });
  }

  async listCredentials(): Promise<CredentialRef[]> {
    return this.withClient(async (client) => {
      const rows = await client.select<CredentialRow>(
        `
          SELECT id, provider, label, created_at, last_used_at
          FROM credentials
          ORDER BY created_at DESC
        `,
      );

      return rows
        .map(normalizeCredentialRow)
        .filter((entry): entry is CredentialRef => entry !== null);
    });
  }

  async createCredential(ref: CredentialRef): Promise<void> {
    const parsed = credentialRefSchema.parse(ref);

    await this.withClient(async (client) => {
      await client.execute(
        `
          INSERT INTO credentials (id, provider, label, created_at, last_used_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT(id) DO UPDATE
            SET provider = excluded.provider,
                label = excluded.label,
                created_at = excluded.created_at,
                last_used_at = excluded.last_used_at
        `,
        [parsed.id, parsed.provider, parsed.label, parsed.createdAt, parsed.lastUsedAt],
      );
    });
  }

  async updateCredentialLastUsed(id: string, ts: number | null): Promise<void> {
    const timestamp = ts === null ? null : Math.max(0, Math.trunc(ts));

    await this.withClient(async (client) => {
      await client.execute(
        `
          UPDATE credentials
          SET last_used_at = $2
          WHERE id = $1
        `,
        [id, timestamp],
      );
    });
  }

  async deleteCredential(id: string): Promise<void> {
    await this.withClient(async (client) => {
      await client.execute('DELETE FROM credentials WHERE id = $1', [id]);
    });
  }

  private ensureHydrated(): void {
    if (this.hydrated || this.hydrationPromise) {
      return;
    }

    const hydrateRevision = this.revision;

    this.hydrationPromise = this.loadByKey()
      .then((loadedValue) => {
        if (this.revision !== hydrateRevision) {
          return;
        }

        this.cache = loadedValue;
        this.hydrated = true;
        this.writeToMirror(loadedValue);
      })
      .catch(() => {
        this.hydrated = true;
      })
      .finally(() => {
        this.hydrationPromise = null;
      });
  }

  private enqueueWrite(task: () => Promise<void>): void {
    this.writePromise = this.writePromise
      .then(task)
      .catch(() => {
        // TODO(extension): surface SQLite write failures via centralized telemetry.
      });
  }

  private validatePayload(payload: unknown): T {
    const migrated = this.migrate(payload);
    const parsed = this.schema.safeParse(migrated);

    if (!parsed.success) {
      return cloneValue(this.defaultValue);
    }

    return parsed.data;
  }

  private loadFromMirror(): T | null {
    if (!this.mirrorStorage) {
      return null;
    }

    try {
      const rawValue = this.mirrorStorage.getItem(this.key);
      if (!rawValue) {
        return null;
      }

      const parsed = safeParseJson(rawValue);
      if (parsed === null) {
        return null;
      }

      return this.validatePayload(parsed);
    } catch {
      return null;
    }
  }

  private writeToMirror(value: T): void {
    if (!this.mirrorStorage) {
      return;
    }

    try {
      this.mirrorStorage.setItem(this.key, JSON.stringify(value));
    } catch {
      // TODO(extension): add telemetry hook for mirror persistence failures.
    }
  }

  private clearMirror(): void {
    if (!this.mirrorStorage) {
      return;
    }

    try {
      this.mirrorStorage.removeItem(this.key);
    } catch {
      // TODO(extension): add telemetry hook for mirror persistence failures.
    }
  }

  private async withClient<TResult>(task: (client: SqliteClient) => Promise<TResult>): Promise<TResult> {
    try {
      return await task(this.client);
    } catch (cause) {
      throw new AppError('DB_UNAVAILABLE', 'SQLite database is unavailable.', cause);
    }
  }

  private async loadByKey(): Promise<T> {
    if (this.key === STORAGE_KEYS.tools) {
      return this.loadTools();
    }

    if (this.key === STORAGE_KEYS.settings) {
      return this.loadSettings();
    }

    if (this.key === STORAGE_KEYS.toolRunLogs) {
      return this.loadToolRunLogs();
    }

    if (this.key === STORAGE_KEYS.workflows) {
      return this.loadWorkflows();
    }

    if (this.key === STORAGE_KEYS.workflowRuns) {
      return this.loadWorkflowRuns();
    }

    if (this.key === STORAGE_KEYS.workflowNodeRuns) {
      return this.loadWorkflowNodeRuns();
    }

    if (this.key === STORAGE_KEYS.schedules) {
      return this.loadSchedules();
    }

    if (this.key === STORAGE_KEYS.scheduledRunLogs) {
      return this.loadScheduledRunLogs();
    }

    if (this.key === STORAGE_KEYS.chatThreads) {
      return this.loadChatThreads();
    }

    return cloneValue(this.defaultValue);
  }

  private async persistByKey(value: T): Promise<void> {
    if (this.key === STORAGE_KEYS.tools) {
      await this.saveTools(value);
      return;
    }

    if (this.key === STORAGE_KEYS.settings) {
      await this.saveSettings(value);
      return;
    }

    if (this.key === STORAGE_KEYS.toolRunLogs) {
      await this.saveToolRunLogs(value);
      return;
    }

    if (this.key === STORAGE_KEYS.workflows) {
      await this.saveWorkflows(value);
      return;
    }

    if (this.key === STORAGE_KEYS.workflowRuns) {
      await this.saveWorkflowRuns(value);
      return;
    }

    if (this.key === STORAGE_KEYS.workflowNodeRuns) {
      await this.saveWorkflowNodeRuns(value);
      return;
    }

    if (this.key === STORAGE_KEYS.schedules) {
      await this.saveSchedules(value);
      return;
    }

    if (this.key === STORAGE_KEYS.scheduledRunLogs) {
      await this.saveScheduledRunLogs(value);
      return;
    }

    if (this.key === STORAGE_KEYS.chatThreads) {
      await this.saveChatThreads(value);
    }
  }

  private async clearByKey(): Promise<void> {
    if (this.key === STORAGE_KEYS.tools) {
      await this.withClient((client) => client.execute('DELETE FROM tools'));
      return;
    }

    if (this.key === STORAGE_KEYS.settings) {
      await this.withClient((client) => client.execute('DELETE FROM settings WHERE id = $1', [SETTINGS_ROW_ID]));
      return;
    }

    if (this.key === STORAGE_KEYS.toolRunLogs) {
      await this.withClient((client) => client.execute('DELETE FROM tool_run_logs'));
      return;
    }

    if (this.key === STORAGE_KEYS.workflows) {
      await this.withClient((client) => client.execute('DELETE FROM workflows'));
      return;
    }

    if (this.key === STORAGE_KEYS.workflowRuns) {
      await this.withClient((client) => client.execute('DELETE FROM workflow_runs'));
      return;
    }

    if (this.key === STORAGE_KEYS.workflowNodeRuns) {
      await this.withClient((client) => client.execute('DELETE FROM workflow_node_runs'));
      return;
    }

    if (this.key === STORAGE_KEYS.schedules) {
      await this.withClient((client) => client.execute('DELETE FROM schedules'));
      return;
    }

    if (this.key === STORAGE_KEYS.scheduledRunLogs) {
      await this.withClient((client) => client.execute('DELETE FROM scheduled_run_logs'));
      return;
    }

    if (this.key === STORAGE_KEYS.chatThreads) {
      await this.withClient((client) => client.execute('DELETE FROM chat_threads'));
    }
  }

  private async loadTools(): Promise<T> {
    const raw = await this.withClient(async (client) => {
      const rows = await client.select<ToolRow>('SELECT config_json FROM tools ORDER BY updated_at DESC');
      const tools = rows
        .map((row) => safeParseJson(row.config_json))
        .map((value) => toolSchema.safeParse(value))
        .filter((result): result is { success: true; data: ReturnType<typeof toolSchema.parse> } => result.success)
        .map((result) => result.data);

      return {
        version: resolveVersion(this.defaultValue),
        tools,
      };
    });

    return this.validatePayload(raw);
  }

  private async saveTools(value: T): Promise<void> {
    const parsed = this.validatePayload(value);
    const payload = parsed as unknown;

    if (!isRecord(payload) || !Array.isArray(payload.tools)) {
      return;
    }

    const validTools = payload.tools
      .map((tool) => toolSchema.safeParse(tool))
      .filter((result): result is { success: true; data: ReturnType<typeof toolSchema.parse> } => result.success)
      .map((result) => result.data);

    await this.withClient(async (client) => {
      await client.execute('BEGIN');
      try {
        await client.execute('DELETE FROM tools');

        for (const tool of validTools) {
          await client.execute(
            `
              INSERT INTO tools (id, tool_type, category, tags, status, config_json, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
              tool.id,
              tool.type,
              tool.category,
              JSON.stringify(tool.tags),
              tool.status,
              JSON.stringify(tool),
              toEpochMs(tool.createdAt),
              toEpochMs(tool.updatedAt),
            ],
          );
        }

        await client.execute('COMMIT');
      } catch (error) {
        await client.execute('ROLLBACK');
        throw error;
      }
    });
  }

  private async loadSettings(): Promise<T> {
    const raw = await this.withClient(async (client) => {
      const rows = await client.select<SettingsRow>(
        `
          SELECT settings_json
          FROM settings
          WHERE id = $1
          LIMIT 1
        `,
        [SETTINGS_ROW_ID],
      );

      if (rows.length === 0) {
        return cloneValue(this.defaultValue);
      }

      const parsed = safeParseJson(rows[0].settings_json);
      if (!parsed) {
        return cloneValue(this.defaultValue);
      }

      const normalized = settingsSchema.safeParse(parsed);
      if (!normalized.success) {
        return cloneValue(this.defaultValue);
      }

      return normalized.data;
    });

    return this.validatePayload(raw);
  }

  private async saveSettings(value: T): Promise<void> {
    const parsed = this.validatePayload(value);

    await this.withClient(async (client) => {
      await client.execute(
        `
          INSERT INTO settings (id, settings_json, updated_at)
          VALUES ($1, $2, $3)
          ON CONFLICT(id) DO UPDATE
            SET settings_json = excluded.settings_json,
                updated_at = excluded.updated_at
        `,
        [SETTINGS_ROW_ID, JSON.stringify(parsed), Date.now()],
      );
    });
  }

  private async loadToolRunLogs(): Promise<T> {
    const raw = await this.withClient(async (client) => {
      const rows = await client.select<ToolRunLogRow>(
        `
          SELECT id, tool_id, ts, action_type, success, request_json, response_json, error_json
          FROM tool_run_logs
          ORDER BY ts DESC
        `,
      );

      const entries = rows
        .map(normalizeRunLogRow)
        .filter((entry): entry is ToolRunLog => entry !== null);

      return {
        version: resolveVersion(this.defaultValue),
        entries,
      };
    });

    return this.validatePayload(raw);
  }

  private async saveToolRunLogs(value: T): Promise<void> {
    const parsed = this.validatePayload(value);
    const payload = parsed as unknown;

    if (!isRecord(payload) || !Array.isArray(payload.entries)) {
      return;
    }

    const validEntries = payload.entries
      .map((entry) => toolRunLogSchema.safeParse(entry))
      .filter((result): result is { success: true; data: ToolRunLog } => result.success)
      .map((result) => result.data);

    await this.withClient(async (client) => {
      await client.execute('BEGIN');
      try {
        await client.execute('DELETE FROM tool_run_logs');

        for (const entry of validEntries) {
          await client.execute(
            `
              INSERT INTO tool_run_logs (
                id,
                tool_id,
                ts,
                action_type,
                success,
                request_json,
                response_json,
                error_json
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
              entry.id,
              entry.toolId,
              toEpochMs(entry.timestamp),
              entry.actionType,
              entry.success ? 1 : 0,
              JSON.stringify(entry.requestSummary),
              JSON.stringify(entry.responseSummary),
              JSON.stringify({ errorDetails: entry.errorDetails }),
            ],
          );
        }

        await client.execute('COMMIT');
      } catch (error) {
        await client.execute('ROLLBACK');
        throw error;
      }
    });
  }

  private async loadWorkflows(): Promise<T> {
    const raw = await this.withClient(async (client) => {
      const rows = await client.select<WorkflowRow>('SELECT workflow_json, updated_at FROM workflows ORDER BY updated_at DESC');
      const workflows = rows
        .map(normalizeWorkflowRow)
        .filter((entry): entry is Workflow => entry !== null);

      return {
        version: workflowSchemaVersion,
        workflows,
      };
    });

    return this.validatePayload(raw);
  }

  private async saveWorkflows(value: T): Promise<void> {
    const parsed = this.validatePayload(value);
    const payload = parsed as unknown;

    if (!isRecord(payload) || !Array.isArray(payload.workflows)) {
      return;
    }

    const validWorkflows = payload.workflows
      .map((workflow) => workflowSchema.safeParse(workflow))
      .filter((result): result is { success: true; data: Workflow } => result.success)
      .map((result) => result.data);

    await this.withClient(async (client) => {
      await client.execute('BEGIN');
      try {
        await client.execute('DELETE FROM workflows');

        for (const workflow of validWorkflows) {
          await client.execute(
            `
              INSERT INTO workflows (id, workflow_json, updated_at)
              VALUES ($1, $2, $3)
            `,
            [workflow.id, JSON.stringify(workflow), toEpochMs(workflow.updatedAt)],
          );
        }

        await client.execute('COMMIT');
      } catch (error) {
        await client.execute('ROLLBACK');
        throw error;
      }
    });
  }

  private async loadWorkflowRuns(): Promise<T> {
    const raw = await this.withClient(async (client) => {
      const rows = await client.select<WorkflowRunRow>('SELECT run_json, ts FROM workflow_runs ORDER BY ts DESC');
      const entries = rows
        .map(normalizeWorkflowRunRow)
        .filter((entry): entry is WorkflowRun => entry !== null);

      return {
        version: workflowRunSchemaVersion,
        entries,
      };
    });

    return this.validatePayload(raw);
  }

  private async saveWorkflowRuns(value: T): Promise<void> {
    const parsed = this.validatePayload(value);
    const payload = parsed as unknown;

    if (!isRecord(payload) || !Array.isArray(payload.entries)) {
      return;
    }

    const validEntries = payload.entries
      .map((entry) => workflowRunSchema.safeParse(entry))
      .filter((result): result is { success: true; data: WorkflowRun } => result.success)
      .map((result) => result.data);

    await this.withClient(async (client) => {
      await client.execute('BEGIN');
      try {
        await client.execute('DELETE FROM workflow_runs');

        for (const entry of validEntries) {
          await client.execute(
            `
              INSERT INTO workflow_runs (id, workflow_id, ts, status, run_json)
              VALUES ($1, $2, $3, $4, $5)
            `,
            [entry.id, entry.workflowId, toEpochMs(entry.startedAt), entry.status, JSON.stringify(entry)],
          );
        }

        await client.execute('COMMIT');
      } catch (error) {
        await client.execute('ROLLBACK');
        throw error;
      }
    });
  }

  private async loadWorkflowNodeRuns(): Promise<T> {
    const raw = await this.withClient(async (client) => {
      const rows = await client.select<WorkflowNodeRunRow>('SELECT node_json, ts FROM workflow_node_runs ORDER BY ts DESC');
      const entries = rows
        .map(normalizeWorkflowNodeRunRow)
        .filter((entry): entry is WorkflowNodeRun => entry !== null);

      return {
        version: workflowNodeRunSchemaVersion,
        entries,
      };
    });

    return this.validatePayload(raw);
  }

  private async saveWorkflowNodeRuns(value: T): Promise<void> {
    const parsed = this.validatePayload(value);
    const payload = parsed as unknown;

    if (!isRecord(payload) || !Array.isArray(payload.entries)) {
      return;
    }

    const validEntries = payload.entries
      .map((entry) => workflowNodeRunSchema.safeParse(entry))
      .filter((result): result is { success: true; data: WorkflowNodeRun } => result.success)
      .map((result) => result.data);

    await this.withClient(async (client) => {
      await client.execute('BEGIN');
      try {
        await client.execute('DELETE FROM workflow_node_runs');

        for (const entry of validEntries) {
          await client.execute(
            `
              INSERT INTO workflow_node_runs (id, workflow_run_id, workflow_id, workflow_step_id, ts, status, node_json)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              entry.id,
              entry.workflowRunId,
              entry.workflowId,
              entry.workflowStepId,
              toEpochMs(entry.startedAt ?? entry.finishedAt ?? new Date().toISOString()),
              entry.status,
              JSON.stringify(entry),
            ],
          );
        }

        await client.execute('COMMIT');
      } catch (error) {
        await client.execute('ROLLBACK');
        throw error;
      }
    });
  }

  private async loadSchedules(): Promise<T> {
    const raw = await this.withClient(async (client) => {
      const rows = await client.select<ScheduleRow>('SELECT schedule_json, updated_at FROM schedules ORDER BY updated_at DESC');
      const schedules = rows
        .map(normalizeScheduleRow)
        .filter((entry): entry is Schedule => entry !== null);

      return {
        version: scheduleSchemaVersion,
        schedules,
      };
    });

    return this.validatePayload(raw);
  }

  private async saveSchedules(value: T): Promise<void> {
    const parsed = this.validatePayload(value);
    const payload = parsed as unknown;

    if (!isRecord(payload) || !Array.isArray(payload.schedules)) {
      return;
    }

    const validSchedules = payload.schedules
      .map((schedule) => scheduleSchema.safeParse(schedule))
      .filter((result): result is { success: true; data: Schedule } => result.success)
      .map((result) => result.data);

    await this.withClient(async (client) => {
      await client.execute('BEGIN');
      try {
        await client.execute('DELETE FROM schedules');

        for (const schedule of validSchedules) {
          await client.execute(
            `
              INSERT INTO schedules (id, workflow_id, enabled, kind, next_run_at, updated_at, schedule_json)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              schedule.id,
              schedule.workflowId,
              schedule.enabled ? 1 : 0,
              schedule.kind,
              schedule.nextRunAt ? toEpochMs(schedule.nextRunAt) : null,
              toEpochMs(schedule.updatedAt),
              JSON.stringify(schedule),
            ],
          );
        }

        await client.execute('COMMIT');
      } catch (error) {
        await client.execute('ROLLBACK');
        throw error;
      }
    });
  }

  private async loadScheduledRunLogs(): Promise<T> {
    const raw = await this.withClient(async (client) => {
      const rows = await client.select<ScheduledRunLogRow>('SELECT log_json, ts FROM scheduled_run_logs ORDER BY ts DESC');
      const entries = rows
        .map(normalizeScheduledRunLogRow)
        .filter((entry): entry is ScheduledRunLog => entry !== null);

      return {
        version: scheduledRunLogSchemaVersion,
        entries,
      };
    });

    return this.validatePayload(raw);
  }

  private async saveScheduledRunLogs(value: T): Promise<void> {
    const parsed = this.validatePayload(value);
    const payload = parsed as unknown;

    if (!isRecord(payload) || !Array.isArray(payload.entries)) {
      return;
    }

    const validEntries = payload.entries
      .map((entry) => scheduledRunLogSchema.safeParse(entry))
      .filter((result): result is { success: true; data: ScheduledRunLog } => result.success)
      .map((result) => result.data);

    await this.withClient(async (client) => {
      await client.execute('BEGIN');
      try {
        await client.execute('DELETE FROM scheduled_run_logs');

        for (const entry of validEntries) {
          await client.execute(
            `
              INSERT INTO scheduled_run_logs (id, schedule_id, workflow_id, ts, status, log_json)
              VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
              entry.id,
              entry.scheduleId,
              entry.workflowId,
              toEpochMs(entry.triggeredAt),
              entry.status,
              JSON.stringify(entry),
            ],
          );
        }

        await client.execute('COMMIT');
      } catch (error) {
        await client.execute('ROLLBACK');
        throw error;
      }
    });
  }

  private async loadChatThreads(): Promise<T> {
    const raw = await this.withClient(async (client) => {
      const rows = await client.select<ChatThreadRow>('SELECT thread_json, updated_at FROM chat_threads ORDER BY updated_at DESC');
      const threads = rows
        .map(normalizeChatThreadRow)
        .filter((entry): entry is ChatThread => entry !== null);

      return {
        version: chatThreadSchemaVersion,
        threads,
      };
    });

    return this.validatePayload(raw);
  }

  private async saveChatThreads(value: T): Promise<void> {
    const parsed = this.validatePayload(value);
    const payload = parsed as unknown;

    if (!isRecord(payload) || !Array.isArray(payload.threads)) {
      return;
    }

    const validThreads = payload.threads
      .map((thread) => chatThreadSchema.safeParse(thread))
      .filter((result): result is { success: true; data: ChatThread } => result.success)
      .map((result) => result.data);

    await this.withClient(async (client) => {
      await client.execute('BEGIN');
      try {
        await client.execute('DELETE FROM chat_threads');

        for (const thread of validThreads) {
          await client.execute(
            `
              INSERT INTO chat_threads (id, updated_at, thread_json)
              VALUES ($1, $2, $3)
            `,
            [thread.id, toEpochMs(thread.updatedAt), JSON.stringify(thread)],
          );
        }

        await client.execute('COMMIT');
      } catch (error) {
        await client.execute('ROLLBACK');
        throw error;
      }
    });
  }
}

export const createSqliteStorageEngine = <T>(options: SqliteStorageEngineOptions<T>): SqliteStorageEngine<T> => {
  return new SqliteStorageEngineImpl(options);
};
