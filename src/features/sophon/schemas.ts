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

export const sophonSourceTypeSchema = z.enum(['folder', 'file', 'project_vault']);

export const sophonDedupeStrategySchema = z.enum(['sha256', 'path_size_mtime']);

export const sophonChangeDetectionSchema = z.enum(['mtime_size_hash', 'hash_only']);

export const sophonRetentionPolicySchema = z.object({
  derivedArtifactsDays: z.number().int().min(1).max(3650),
  snapshotRetentionDays: z.number().int().min(1).max(3650),
  keepFailedJobArtifactsDays: z.number().int().min(1).max(3650),
});

export const sophonSourceSettingsSchema = z.object({
  includePatterns: z.array(z.string().trim().min(1).max(200)).max(50),
  excludePatterns: z.array(z.string().trim().min(1).max(200)).max(50),
  allowedExtensions: z.array(z.string().trim().min(1).max(20)).max(100),
  maxFileSizeMb: z.number().int().min(1).max(102400),
  maxPages: z.number().int().min(1).max(100000),
  watchEnabled: z.boolean(),
  watchIntervalSec: z.number().int().min(5).max(86400),
  debounceSeconds: z.number().int().min(1).max(600),
  dedupeStrategy: sophonDedupeStrategySchema,
  changeDetection: sophonChangeDetectionSchema,
  retention: sophonRetentionPolicySchema,
  chunkSize: z.number().int().min(128).max(32768),
  chunkOverlap: z.number().int().min(0).max(4096),
  pageAwareChunking: z.boolean(),
  ocrEnabled: z.boolean(),
  extractionEnabled: z.boolean(),
});

export const sophonSourceSchema = z.object({
  id: z.string().min(1),
  sourceType: sophonSourceTypeSchema,
  name: z.string().trim().min(1).max(160),
  path: z.string().trim().min(1).max(500),
  enabled: z.boolean(),
  settings: sophonSourceSettingsSchema,
  tags: z.array(z.string().trim().min(1).max(60)).max(20),
  sensitivity: sophonSensitivitySchema,
  clientBoundaryTag: z.string().trim().min(1).max(120).optional(),
  projectBoundaryTag: z.string().trim().min(1).max(120).optional(),
  lastScanAt: z.string().datetime().optional(),
  lastIngestedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const sophonIngestionStageSchema = z.enum([
  'enumerate',
  'classify',
  'extract',
  'normalize',
  'chunk',
  'embed',
  'index',
  'validate',
  'publish',
]);

export const sophonStageStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'skipped',
  'paused',
]);

export const sophonStageMetricSchema = z.object({
  stage: sophonIngestionStageSchema,
  status: sophonStageStatusSchema,
  progressPct: z.number().int().min(0).max(100),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  latencyMs: z.number().int().min(0).optional(),
  filesProcessed: z.number().int().min(0),
  chunksProduced: z.number().int().min(0),
  errorCount: z.number().int().min(0),
  message: z.string().trim().max(500).optional(),
});

export const sophonCheckpointSchema = z.object({
  stage: sophonIngestionStageSchema,
  cursor: z.string().trim().min(1).max(500),
  persistedAt: z.string().datetime(),
});

export const sophonValidationSummarySchema = z.object({
  integrityPass: z.boolean(),
  retrievalSanityPass: z.boolean(),
  orphanedChunks: z.number().int().min(0),
  missingMetadataRows: z.number().int().min(0),
  warnings: z.array(z.string().trim().min(1).max(500)).max(100),
  errors: z.array(z.string().trim().min(1).max(500)).max(100),
});

export const sophonIngestionJobStatusSchema = z.enum([
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);

export const sophonIngestionJobOptionsSchema = z.object({
  dryRun: z.boolean(),
  safeMode: z.boolean(),
  maxWorkers: z.number().int().min(1).max(128),
});

export const sophonIngestionJobSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  sourceName: z.string().min(1),
  status: sophonIngestionJobStatusSchema,
  currentStage: sophonIngestionStageSchema,
  stages: z.array(sophonStageMetricSchema).length(9),
  checkpoints: z.array(sophonCheckpointSchema).max(200),
  options: sophonIngestionJobOptionsSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  retries: z.number().int().min(0).max(99),
  discoveredFiles: z.number().int().min(0),
  processedDocuments: z.number().int().min(0),
  failedDocuments: z.number().int().min(0),
  producedChunks: z.number().int().min(0),
  blockedByPolicy: z.boolean(),
  validation: sophonValidationSummarySchema,
  failureReason: z.string().trim().max(500).optional(),
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

export const sophonOfflineGateEvidenceSchema = z.object({
  id: z.string().min(1),
  attemptedTarget: z.string().trim().min(1).max(500),
  reason: z.string().trim().min(1).max(500),
  blockedAt: z.string().datetime(),
});

export const sophonMetricsPointSchema = z.object({
  ts: z.string().datetime(),
  filesPerMinute: z.number().min(0).max(100000),
  chunksPerSecond: z.number().min(0).max(100000),
  stageLatencyMsP95: z.number().min(0).max(300000),
  errorRatePct: z.number().min(0).max(100),
});

export const sophonLogEntrySchema = z.object({
  id: z.string().min(1),
  ts: z.string().datetime(),
  severity: z.enum(['debug', 'info', 'warn', 'error']),
  source: z.enum(['runtime', 'ingestion', 'index', 'retrieval', 'policy', 'backup']),
  jobId: z.string().trim().min(1).max(120).optional(),
  stage: sophonIngestionStageSchema.optional(),
  sourceId: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(1000),
});

export const sophonRuntimeReadinessCheckSchema = z.object({
  id: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  status: z.enum(['pass', 'warn', 'fail']),
  blocking: z.boolean(),
  message: z.string().trim().min(1).max(2000),
  remediation: z.array(z.string().trim().min(1).max(500)).max(20),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const sophonRuntimeReadinessReportSchema = z.object({
  generatedAt: z.string().datetime(),
  state: z.enum(['ready', 'degraded', 'blocked']),
  summary: z.string().trim().min(1).max(2000),
  blockerCount: z.number().int().min(0).max(1000),
  warningCount: z.number().int().min(0).max(1000),
  checks: z.array(sophonRuntimeReadinessCheckSchema).max(100),
});

export const sophonSystemStateSchema = z.object({
  version: z.literal(sophonSchemaVersion),
  runtime: z.object({
    transport: z.enum(['in_process', 'ipc_named_pipe', 'ipc_stdio']),
    engineMode: z.enum(['embedded_nvidia', 'compatibility_local']),
    status: z.enum(['stopped', 'starting', 'running', 'degraded']),
    gpuAvailable: z.boolean(),
    modelLoaded: z.boolean(),
    vectorStoreReady: z.boolean(),
    diskUsagePct: z.number().min(0).max(100),
    queueDepth: z.number().int().min(0),
    activeWorkers: z.number().int().min(0).max(256),
    lastHealthCheckAt: z.string().datetime().optional(),
  }),
  role: sophonRoleSchema,
  offlineOnlyEnforced: z.literal(true),
  egressBlocked: z.boolean(),
  blockedEgressAttempts: z.array(sophonOfflineGateEvidenceSchema).max(2000),
  crossClientMixingPrevented: z.boolean(),
  sources: z.array(sophonSourceSchema).max(500),
  jobs: z.array(sophonIngestionJobSchema).max(5000),
  index: z.object({
    docCount: z.number().int().min(0),
    chunkCount: z.number().int().min(0),
    embeddingModel: z.string().trim().min(1).max(120),
    lastUpdatedAt: z.string().datetime().optional(),
    lastValidatedAt: z.string().datetime().optional(),
    activeSnapshotId: z.string().trim().min(1).max(120).optional(),
    integrityStatus: z.enum(['unknown', 'healthy', 'degraded']),
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
    maxIngestionWorkers: z.number().int().min(1).max(128),
    forceCpuOnly: z.boolean(),
  }),
  metrics: z.array(sophonMetricsPointSchema).max(10000),
  logs: z.array(sophonLogEntrySchema).max(15000),
  audit: z.array(sophonAuditEventSchema).max(10000),
  activity: z.array(z.string().trim().min(1).max(500)).max(2000),
  runtimeReadiness: sophonRuntimeReadinessReportSchema.optional(),
  lastRetrieval: sophonRetrievalResultSchema.optional(),
});

export const sophonStoreSchema = z.object({
  version: z.literal(sophonSchemaVersion),
  state: sophonSystemStateSchema,
});

export type SophonStoreState = z.infer<typeof sophonStoreSchema>;
export type SophonValidatedSystemState = SophonSystemState;
