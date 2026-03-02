import { describe, expect, it } from 'vitest';
import {
  AuditService,
  type AuditExportFormat,
  type AuditRecord,
} from '../../src/services/audit/AuditService';

class InMemoryAuditRepository {
  private readonly records: AuditRecord[] = [];

  async getLatestByProject(workspaceId: string, projectId: string): Promise<AuditRecord | null> {
    const scoped = this.records.filter((record) => {
      return record.workspaceId === workspaceId && record.projectId === projectId;
    });
    return scoped[scoped.length - 1] ?? null;
  }

  async listByProject(workspaceId: string, projectId: string): Promise<readonly AuditRecord[]> {
    return this.records
      .filter((record) => {
        return record.workspaceId === workspaceId && record.projectId === projectId;
      })
      .slice()
      .sort((left, right) => {
        const byTimestamp = left.eventTsUtc.localeCompare(right.eventTsUtc);
        if (byTimestamp !== 0) {
          return byTimestamp;
        }
        return left.id.localeCompare(right.id);
      });
  }

  async insert(record: AuditRecord): Promise<void> {
    this.records.push(record);
  }

  tamperRecordById(recordId: string, mutate: (record: AuditRecord) => AuditRecord): void {
    const index = this.records.findIndex((record) => record.id === recordId);
    if (index < 0) {
      throw new Error(`record not found: ${recordId}`);
    }
    this.records[index] = mutate(this.records[index] as AuditRecord);
  }
}

const parseExport = (format: AuditExportFormat, content: string): AuditRecord[] => {
  if (format === 'json') {
    return JSON.parse(content) as AuditRecord[];
  }

  if (format === 'jsonl') {
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as AuditRecord);
  }

  const lines = content.split('\n').filter((line) => line.trim().length > 0);
  const rows = lines.slice(1);
  return rows.map((line) => {
    const cells = splitCsv(line).map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"'));
    return {
      id: cells[0] ?? '',
      workspaceId: cells[1] ?? '',
      projectId: cells[2] ?? '',
      actorId: cells[3] ?? '',
      action: cells[4] ?? '',
      entityType: cells[5] ?? '',
      entityId: cells[6] ?? '',
      eventTsUtc: cells[7] ?? '',
      prevHash: cells[8] ? cells[8] : null,
      eventHash: cells[9] ?? '',
      canonicalPayloadJson: '',
      hashAlgorithm: (cells[10] as 'sha256') || 'sha256',
      chainVersion: Number(cells[11] ?? 1),
    } satisfies AuditRecord;
  });
};

function splitCsv(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }
  cells.push(current);
  return cells;
}

describe('Audit chain evaluation harness', () => {
  it('detects tampering via verifyAuditChain', async () => {
    const repository = new InMemoryAuditRepository();
    const service = new AuditService(repository, 'workspace-eval', 'project-eval');

    const first = await service.appendAuditEvent({
      actorId: 'actor-1',
      action: 'artifact.ingested',
      entityType: 'artifact',
      entityId: 'artifact-1',
      metadata: {
        hash: 'aaa',
      },
      eventTsUtc: '2026-03-02T00:00:00.000Z',
    });
    expect(first.ok).toBe(true);

    const second = await service.appendAuditEvent({
      actorId: 'actor-2',
      action: 'deliverable.finalized',
      entityType: 'deliverable',
      entityId: 'deliverable-1',
      metadata: {
        versionNo: 1,
      },
      eventTsUtc: '2026-03-02T00:00:01.000Z',
    });
    expect(second.ok).toBe(true);
    const secondId = second.value?.id;
    expect(secondId).toBeTruthy();

    const verifiedBeforeTamper = await service.verifyAuditChain();
    expect(verifiedBeforeTamper.ok).toBe(true);
    expect(verifiedBeforeTamper.value?.valid).toBe(true);

    repository.tamperRecordById(secondId as string, (record) => {
      return {
        ...record,
        canonicalPayloadJson: '{"tampered":true}',
      };
    });

    const verifiedAfterTamper = await service.verifyAuditChain();
    expect(verifiedAfterTamper.ok).toBe(true);
    expect(verifiedAfterTamper.value?.valid).toBe(false);
    expect(verifiedAfterTamper.value?.brokenEventId).toBe(secondId);
    expect(verifiedAfterTamper.value?.reason).toBe('event_hash mismatch');
  });

  it('maintains record-count parity across JSON, JSONL, and CSV exports', async () => {
    const repository = new InMemoryAuditRepository();
    const service = new AuditService(repository, 'workspace-eval', 'project-export');

    for (let index = 0; index < 3; index += 1) {
      const appended = await service.appendAuditEvent({
        actorId: `actor-${index}`,
        action: 'query.executed',
        entityType: 'ai_query',
        entityId: `query-${index}`,
        metadata: {
          citations: index + 1,
        },
        eventTsUtc: `2026-03-02T00:00:0${index}.000Z`,
      });
      expect(appended.ok).toBe(true);
    }

    const jsonExport = await service.exportAuditLog('json');
    const jsonlExport = await service.exportAuditLog('jsonl');
    const csvExport = await service.exportAuditLog('csv');

    expect(jsonExport.ok).toBe(true);
    expect(jsonlExport.ok).toBe(true);
    expect(csvExport.ok).toBe(true);

    const jsonRows = parseExport('json', jsonExport.value?.content ?? '');
    const jsonlRows = parseExport('jsonl', jsonlExport.value?.content ?? '');
    const csvRows = parseExport('csv', csvExport.value?.content ?? '');

    expect(jsonRows).toHaveLength(3);
    expect(jsonlRows).toHaveLength(3);
    expect(csvRows).toHaveLength(3);
  });
});

