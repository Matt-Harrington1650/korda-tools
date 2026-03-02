import { AppError, isAppError } from '../../lib/errors';
import { sha256 } from '../crypto/sha256';

export type AuditExportFormat = 'json' | 'jsonl' | 'csv';

export interface AuditEventInput {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  eventTsUtc?: string;
}

export interface AuditRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  eventTsUtc: string;
  prevHash: string | null;
  eventHash: string;
  canonicalPayloadJson: string;
  hashAlgorithm: 'sha256';
  chainVersion: number;
}

interface AuditRepository {
  getLatestByProject(workspaceId: string, projectId: string): Promise<AuditRecord | null>;
  listByProject(workspaceId: string, projectId: string): Promise<readonly AuditRecord[]>;
  insert(record: AuditRecord): Promise<void>;
}

export interface AuditServiceResult<T> {
  ok: boolean;
  value?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface VerifyAuditChainResult {
  valid: boolean;
  checkedCount: number;
  brokenEventId?: string;
  reason?: string;
}

export interface ExportAuditLogResult {
  format: AuditExportFormat;
  content: string;
  mimeType: string;
  fileName: string;
  recordCount: number;
}

export class AuditService {
  private readonly repository: AuditRepository;
  private readonly workspaceId: string;
  private readonly projectId: string;

  constructor(repository: AuditRepository, workspaceId: string, projectId: string) {
    this.repository = repository;
    this.workspaceId = workspaceId;
    this.projectId = projectId;
  }

  async appendAuditEvent(event: AuditEventInput): Promise<AuditServiceResult<AuditRecord>> {
    try {
      const latest = await this.repository.getLatestByProject(this.workspaceId, this.projectId);
      const prevHash = latest?.eventHash ?? null;
      const eventTsUtc = event.eventTsUtc ?? new Date().toISOString();

      const payload = {
        workspace_id: this.workspaceId,
        project_id: this.projectId,
        actor_id: event.actorId,
        action: event.action,
        entity_type: event.entityType,
        entity_id: event.entityId,
        event_ts_utc: eventTsUtc,
        metadata: event.metadata ?? {},
      };

      const canonicalPayloadJson = canonicalJsonSerialize(payload);
      const thisHash = await computeAuditHash(prevHash, canonicalPayloadJson);

      const record: AuditRecord = {
        id: createId('audit'),
        workspaceId: this.workspaceId,
        projectId: this.projectId,
        actorId: event.actorId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        eventTsUtc,
        prevHash,
        eventHash: thisHash,
        canonicalPayloadJson,
        hashAlgorithm: 'sha256',
        chainVersion: 1,
      };

      await this.repository.insert(record);
      return { ok: true, value: record };
    } catch (error) {
      return fail('AUDIT_APPEND_FAILED', 'Failed to append audit event.', error);
    }
  }

  async verifyAuditChain(): Promise<AuditServiceResult<VerifyAuditChainResult>> {
    try {
      const records = await this.repository.listByProject(this.workspaceId, this.projectId);

      let expectedPrev: string | null = null;
      for (const record of records) {
        if (record.prevHash !== expectedPrev) {
          return {
            ok: true,
            value: {
              valid: false,
              checkedCount: records.length,
              brokenEventId: record.id,
              reason: 'prev_hash mismatch',
            },
          };
        }

        if (record.hashAlgorithm !== 'sha256') {
          return {
            ok: true,
            value: {
              valid: false,
              checkedCount: records.length,
              brokenEventId: record.id,
              reason: 'unsupported hash algorithm',
            },
          };
        }

        const recomputed = await computeAuditHash(record.prevHash, record.canonicalPayloadJson);
        if (recomputed !== record.eventHash) {
          return {
            ok: true,
            value: {
              valid: false,
              checkedCount: records.length,
              brokenEventId: record.id,
              reason: 'event_hash mismatch',
            },
          };
        }

        expectedPrev = record.eventHash;
      }

      return {
        ok: true,
        value: {
          valid: true,
          checkedCount: records.length,
        },
      };
    } catch (error) {
      return fail('AUDIT_VERIFY_FAILED', 'Failed to verify audit chain.', error);
    }
  }

  async exportAuditLog(format: AuditExportFormat): Promise<AuditServiceResult<ExportAuditLogResult>> {
    try {
      const records = await this.repository.listByProject(this.workspaceId, this.projectId);
      const exported = toExportContent(format, records);

      return {
        ok: true,
        value: {
          format,
          content: exported.content,
          mimeType: exported.mimeType,
          fileName: `audit-log-${this.projectId}.${exported.extension}`,
          recordCount: records.length,
        },
      };
    } catch (error) {
      return fail('AUDIT_EXPORT_FAILED', 'Failed to export audit log.', error);
    }
  }
}

export function canonicalJsonSerialize(input: unknown): string {
  const normalized = canonicalizeValue(input);
  return JSON.stringify(normalized);
}

async function computeAuditHash(prevHash: string | null, canonicalPayloadJson: string): Promise<string> {
  const material = `${prevHash ?? ''}${canonicalPayloadJson}`;
  const bytes = new TextEncoder().encode(material);
  return sha256(bytes);
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }

  if (value !== null && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort();
    const output: Record<string, unknown> = {};

    for (const key of keys) {
      const child = objectValue[key];
      if (typeof child !== 'undefined') {
        output[key] = canonicalizeValue(child);
      }
    }

    return output;
  }

  return value;
}

function toExportContent(
  format: AuditExportFormat,
  records: readonly AuditRecord[],
): { content: string; mimeType: string; extension: string } {
  if (format === 'json') {
    return {
      content: JSON.stringify(records, null, 2),
      mimeType: 'application/json',
      extension: 'json',
    };
  }

  if (format === 'jsonl') {
    return {
      content: records.map((record) => JSON.stringify(record)).join('\n'),
      mimeType: 'application/x-ndjson',
      extension: 'jsonl',
    };
  }

  const header =
    'id,workspaceId,projectId,actorId,action,entityType,entityId,eventTsUtc,prevHash,eventHash,hashAlgorithm,chainVersion';
  const lines = records.map((record) => {
    const cells = [
      record.id,
      record.workspaceId,
      record.projectId,
      record.actorId,
      record.action,
      record.entityType,
      record.entityId,
      record.eventTsUtc,
      record.prevHash ?? '',
      record.eventHash,
      record.hashAlgorithm,
      String(record.chainVersion),
    ];
    return cells.map(escapeCsvCell).join(',');
  });

  return {
    content: [header, ...lines].join('\n'),
    mimeType: 'text/csv',
    extension: 'csv',
  };
}

function escapeCsvCell(input: string): string {
  const escaped = input.replace(/"/g, '""');
  return `"${escaped}"`;
}

function fail<T>(code: string, message: string, error: unknown): AuditServiceResult<T> {
  if (isAppError(error)) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  const fallback = new AppError(code, message, error);
  return {
    ok: false,
    error: {
      code: fallback.code,
      message: fallback.message,
      details: fallback.details,
    },
  };
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// TODO: Add signature and trusted timestamp hooks for future non-repudiation.
// TODO: Add repository implementation with deterministic ordering at query layer.