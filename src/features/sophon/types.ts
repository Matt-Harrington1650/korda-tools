export type SophonRuntimeStatus = 'stopped' | 'starting' | 'running' | 'degraded';

export type SophonRole = 'admin' | 'operator' | 'viewer';

export type SophonSensitivity = 'Public' | 'Internal' | 'Confidential' | 'Client-Confidential';

export type SophonSource = {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
  includePatterns: string[];
  excludePatterns: string[];
  chunkSize: number;
  chunkOverlap: number;
  ocrEnabled: boolean;
  extractionEnabled: boolean;
  tags: string[];
  sensitivity: SophonSensitivity;
  createdAt: string;
  updatedAt: string;
};

export type SophonIngestionJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type SophonIngestionJob = {
  id: string;
  sourceId: string;
  sourceName: string;
  status: SophonIngestionJobStatus;
  startedAt: string;
  endedAt?: string;
  retries: number;
  processedDocuments: number;
  failedDocuments: number;
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

export type SophonSystemState = {
  version: 1;
  runtime: {
    status: SophonRuntimeStatus;
    gpuAvailable: boolean;
    modelLoaded: boolean;
    vectorStoreReady: boolean;
    diskUsagePct: number;
    queueDepth: number;
    lastHealthCheckAt?: string;
  };
  role: SophonRole;
  offlineOnlyEnforced: true;
  egressBlocked: boolean;
  sources: SophonSource[];
  jobs: SophonIngestionJob[];
  index: SophonIndexState;
  tuning: SophonTuningState;
  audit: SophonAuditEvent[];
  activity: string[];
  lastRetrieval?: SophonRetrievalResult;
};

