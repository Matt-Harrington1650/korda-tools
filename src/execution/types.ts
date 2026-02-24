import type { Tool, ToolType } from '../domain/tool';

export type ExecutionActionType = 'test' | 'run';

export type ToolCapabilityFlags = {
  canTestConnection: boolean;
  canRun: boolean;
  supportsHeaders: boolean;
  supportsPayload: boolean;
};

export type ExecutionRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
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
