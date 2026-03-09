export type SophonRuntimeStatus = 'stopped' | 'starting' | 'running' | 'degraded';

export type SophonRole = 'admin' | 'operator' | 'viewer';

export type SophonSensitivity = 'Public' | 'Internal' | 'Confidential' | 'Client-Confidential';

export type SophonSourceType = 'folder' | 'file' | 'project_vault';

export type SophonDedupeStrategy = 'sha256' | 'path_size_mtime';

export type SophonChangeDetection = 'mtime_size_hash' | 'hash_only';

export type SophonRetentionPolicy = {
  derivedArtifactsDays: number;
  snapshotRetentionDays: number;
  keepFailedJobArtifactsDays: number;
};

export type SophonSourceSettings = {
  includePatterns: string[];
  excludePatterns: string[];
  allowedExtensions: string[];
  maxFileSizeMb: number;
  maxPages: number;
  watchEnabled: boolean;
  watchIntervalSec: number;
  debounceSeconds: number;
  dedupeStrategy: SophonDedupeStrategy;
  changeDetection: SophonChangeDetection;
  retention: SophonRetentionPolicy;
  chunkSize: number;
  chunkOverlap: number;
  pageAwareChunking: boolean;
  ocrEnabled: boolean;
  extractionEnabled: boolean;
};

export type SophonSource = {
  id: string;
  sourceType: SophonSourceType;
  name: string;
  path: string;
  enabled: boolean;
  settings: SophonSourceSettings;
  tags: string[];
  sensitivity: SophonSensitivity;
  clientBoundaryTag?: string;
  projectBoundaryTag?: string;
  lastScanAt?: string;
  lastIngestedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SophonIngestionStage =
  | 'enumerate'
  | 'classify'
  | 'extract'
  | 'normalize'
  | 'chunk'
  | 'embed'
  | 'index'
  | 'validate'
  | 'publish';

export type SophonStageStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped' | 'paused';

export type SophonStageMetric = {
  stage: SophonIngestionStage;
  status: SophonStageStatus;
  progressPct: number;
  startedAt?: string;
  endedAt?: string;
  latencyMs?: number;
  filesProcessed: number;
  chunksProduced: number;
  errorCount: number;
  message?: string;
};

export type SophonIngestionCheckpoint = {
  stage: SophonIngestionStage;
  cursor: string;
  persistedAt: string;
};

export type SophonValidationSummary = {
  integrityPass: boolean;
  retrievalSanityPass: boolean;
  orphanedChunks: number;
  missingMetadataRows: number;
  warnings: string[];
  errors: string[];
};

export type SophonIngestionJobStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type SophonIngestionJobOptions = {
  dryRun: boolean;
  safeMode: boolean;
  maxWorkers: number;
};

export type SophonIngestionJob = {
  id: string;
  sourceId: string;
  sourceName: string;
  status: SophonIngestionJobStatus;
  currentStage: SophonIngestionStage;
  stages: SophonStageMetric[];
  checkpoints: SophonIngestionCheckpoint[];
  options: SophonIngestionJobOptions;
  startedAt: string;
  endedAt?: string;
  retries: number;
  discoveredFiles: number;
  processedDocuments: number;
  failedDocuments: number;
  producedChunks: number;
  blockedByPolicy: boolean;
  validation: SophonValidationSummary;
  failureReason?: string;
};

export type SophonIndexSnapshot = {
  id: string;
  name: string;
  createdAt: string;
  docCount: number;
  chunkCount: number;
  embeddingModel: string;
};

export type SophonIndexState = {
  docCount: number;
  chunkCount: number;
  embeddingModel: string;
  lastUpdatedAt?: string;
  lastValidatedAt?: string;
  activeSnapshotId?: string;
  integrityStatus: 'unknown' | 'healthy' | 'degraded';
  revision: number;
  snapshots: SophonIndexSnapshot[];
};

export type SophonTuningState = {
  embeddingModel: string;
  retrieverTopK: number;
  rerankerEnabled: boolean;
  rerankerThreshold: number;
  scoreThreshold: number;
  contextWindowTokens: number;
  responseMaxTokens: number;
  explainRetrieval: boolean;
  maxIngestionWorkers: number;
  forceCpuOnly: boolean;
};

export type SophonAuditEvent = {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  eventTsUtc: string;
  severity: 'info' | 'warn' | 'error';
};

export type SophonRetrievalResult = {
  query: string;
  answer: string;
  passages: Array<{
    sourceName: string;
    score: number;
    content: string;
  }>;
  generatedAt: string;
};

export type SophonOfflineGateEvidence = {
  id: string;
  attemptedTarget: string;
  reason: string;
  blockedAt: string;
};

export type SophonMetricsPoint = {
  ts: string;
  filesPerMinute: number;
  chunksPerSecond: number;
  stageLatencyMsP95: number;
  errorRatePct: number;
};

export type SophonLogEntry = {
  id: string;
  ts: string;
  severity: 'debug' | 'info' | 'warn' | 'error';
  source: 'runtime' | 'ingestion' | 'index' | 'retrieval' | 'policy' | 'backup';
  jobId?: string;
  stage?: SophonIngestionStage;
  sourceId?: string;
  message: string;
};

export type SophonSystemState = {
  version: 1;
  runtime: {
    transport: 'in_process' | 'ipc_named_pipe' | 'ipc_stdio';
    engineMode: 'embedded_nvidia' | 'compatibility_local';
    status: SophonRuntimeStatus;
    gpuAvailable: boolean;
    modelLoaded: boolean;
    vectorStoreReady: boolean;
    diskUsagePct: number;
    queueDepth: number;
    activeWorkers: number;
    lastHealthCheckAt?: string;
  };
  role: SophonRole;
  offlineOnlyEnforced: true;
  egressBlocked: boolean;
  blockedEgressAttempts: SophonOfflineGateEvidence[];
  crossClientMixingPrevented: boolean;
  sources: SophonSource[];
  jobs: SophonIngestionJob[];
  index: SophonIndexState;
  tuning: SophonTuningState;
  metrics: SophonMetricsPoint[];
  logs: SophonLogEntry[];
  audit: SophonAuditEvent[];
  activity: string[];
  lastRetrieval?: SophonRetrievalResult;
};
