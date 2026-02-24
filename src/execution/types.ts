import type { Tool, ToolRetryPolicy, ToolType } from '../domain/tool';

export type ExecutionActionType = 'test' | 'run';

export type ToolCapabilityFlags = {
  canTestConnection: boolean;
  canRun: boolean;
  supportsHeaders: boolean;
  supportsPayload: boolean;
  supportsFiles?: boolean;
  supportsStreaming?: boolean;
};

export type ExecutionAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataBase64: string;
};

export type ExecutionRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  attachments?: ExecutionAttachment[];
};

export type RawExecutionResponse = {
  statusCode: number | null;
  headers: Record<string, string>;
  body: string;
};

export type NormalizedExecutionResponse = {
  statusCode: number | null;
  headers: Record<string, string>;
  body: string;
  bodyPreview: string;
};

export type AdapterBuildRequestInput = {
  tool: Tool;
  actionType: ExecutionActionType;
  payload?: string;
  attachments?: ExecutionAttachment[];
};

export type AdapterExecutionContext = {
  actionType: ExecutionActionType;
  timeoutMs: number;
  signal: AbortSignal;
};

export type ToolExecutionError = {
  code: string;
  message: string;
  details: string;
  stack?: string;
};

export type ExecutionStatusPhase =
  | 'queued'
  | 'running'
  | 'validating_config'
  | 'building_request'
  | 'executing'
  | 'normalizing_response'
  | 'completed'
  | 'cancelled';

export type ExecutionStatusEvent = {
  type: 'status';
  phase: ExecutionStatusPhase;
  message?: string;
};

export type ExecutionProgressEvent = {
  type: 'progress';
  progress: number;
  message?: string;
};

export type ExecutionChunkEvent = {
  type: 'chunk';
  chunk: string;
  mimeType?: string;
};

export type ExecutionSuccessResult = {
  ok: true;
  actionType: ExecutionActionType;
  toolType: ToolType;
  request: ExecutionRequest;
  response: NormalizedExecutionResponse;
  requestSummary: string;
  responseSummary: string;
  durationMs: number;
};

export type ExecutionErrorResult = {
  ok: false;
  actionType: ExecutionActionType;
  toolType: ToolType;
  request: ExecutionRequest | null;
  requestSummary: string;
  responseSummary: string;
  durationMs: number;
  error: ToolExecutionError;
};

export type ExecutionResult = ExecutionSuccessResult | ExecutionErrorResult;

export type ExecutionResultEvent = {
  type: 'result';
  result: ExecutionResult;
};

export type ExecutionErrorEvent = {
  type: 'error';
  error: ToolExecutionError;
};

export type ExecutionEvent =
  | ExecutionStatusEvent
  | ExecutionProgressEvent
  | ExecutionChunkEvent
  | ExecutionResultEvent
  | ExecutionErrorEvent;

export type PipelineRetryPolicy = ToolRetryPolicy;

export type ExecutionPipelineConfig = {
  defaultTimeoutMs: number;
  globalMaxConcurrentRuns: number;
  defaultRetryPolicy: PipelineRetryPolicy;
};

export type ExecutionQueueCounters = {
  queued: number;
  running: number;
};

export type ExecutionQueueState = {
  global: ExecutionQueueCounters;
  tools: Record<string, ExecutionQueueCounters>;
};
