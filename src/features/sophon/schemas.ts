import { z } from 'zod';
import type { SophonSystemState } from './types';

export const sophonSchemaVersion = 1 as const;

export const sophonRoleSchema = z.enum(['admin', 'operator', 'viewer']);

export const sophonSensitivitySchema = z.enum([
  'Public',
  'Internal',
  'Confidential',
  'Client-Confidential',
]);

export const sophonSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  path: z.string().trim().min(1).max(500),
  enabled: z.boolean(),
  includePatterns: z.array(z.string().trim().min(1).max(160)).max(30),
  excludePatterns: z.array(z.string().trim().min(1).max(160)).max(30),
  chunkSize: z.number().int().min(128).max(8192),
  chunkOverlap: z.number().int().min(0).max(2048),
  ocrEnabled: z.boolean(),
  extractionEnabled: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20),
  sensitivity: sophonSensitivitySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const sophonIngestionJobStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export const sophonIngestionJobSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  sourceName: z.string().min(1),
  status: sophonIngestionJobStatusSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  retries: z.number().int().min(0).max(99),
  processedDocuments: z.number().int().min(0),
  failedDocuments: z.number().int().min(0),
  failureReason: z.string().max(500).optional(),
});

export const sophonIndexSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  createdAt: z.string().datetime(),
  docCount: z.number().int().min(0),
  chunkCount: z.number().int().min(0),
  embeddingModel: z.string().trim().min(1).max(120),
});

export const sophonAuditEventSchema = z.object({
  id: z.string().min(1),
  actorId: z.string().trim().min(1).max(80),
  action: z.string().trim().min(1).max(160),
  entityType: z.string().trim().min(1).max(120),
  entityId: z.string().trim().min(1).max(160),
  details: z.string().trim().max(2000),
  eventTsUtc: z.string().datetime(),
  severity: z.enum(['info', 'warn', 'error']),
});

export const sophonRetrievalResultSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  answer: z.string().trim().min(1),
  passages: z.array(
    z.object({
      sourceName: z.string().trim().min(1).max(160),
      score: z.number().min(0).max(1),
      content: z.string().trim().min(1),
    }),
  ),
  generatedAt: z.string().datetime(),
});

export const sophonSystemStateSchema = z.object({
  version: z.literal(sophonSchemaVersion),
  runtime: z.object({
    status: z.enum(['stopped', 'starting', 'running', 'degraded']),
    gpuAvailable: z.boolean(),
    modelLoaded: z.boolean(),
    vectorStoreReady: z.boolean(),
    diskUsagePct: z.number().min(0).max(100),
    queueDepth: z.number().int().min(0),
    lastHealthCheckAt: z.string().datetime().optional(),
  }),
  role: sophonRoleSchema,
  offlineOnlyEnforced: z.literal(true),
  egressBlocked: z.boolean(),
  sources: z.array(sophonSourceSchema).max(500),
  jobs: z.array(sophonIngestionJobSchema).max(5000),
  index: z.object({
    docCount: z.number().int().min(0),
    chunkCount: z.number().int().min(0),
    embeddingModel: z.string().trim().min(1).max(120),
    lastUpdatedAt: z.string().datetime().optional(),
    revision: z.number().int().min(1),
    snapshots: z.array(sophonIndexSnapshotSchema).max(200),
  }),
  tuning: z.object({
    embeddingModel: z.string().trim().min(1).max(120),
    retrieverTopK: z.number().int().min(1).max(200),
    rerankerEnabled: z.boolean(),
    rerankerThreshold: z.number().min(0).max(1),
    scoreThreshold: z.number().min(0).max(1),
    contextWindowTokens: z.number().int().min(1024).max(512000),
    responseMaxTokens: z.number().int().min(64).max(65536),
    explainRetrieval: z.boolean(),
  }),
  audit: z.array(sophonAuditEventSchema).max(10000),
  activity: z.array(z.string().trim().min(1).max(500)).max(2000),
  lastRetrieval: sophonRetrievalResultSchema.optional(),
});

export const sophonStoreSchema = z.object({
  version: z.literal(sophonSchemaVersion),
  state: sophonSystemStateSchema,
});

export type SophonStoreState = z.infer<typeof sophonStoreSchema>;
export type SophonValidatedSystemState = SophonSystemState;

