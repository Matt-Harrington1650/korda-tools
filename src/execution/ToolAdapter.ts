import type { Tool } from '../domain/tool';
import type {
  AdapterBuildRequestInput,
  AdapterExecutionContext,
  ExecutionRequest,
  NormalizedExecutionResponse,
  RawExecutionResponse,
  ToolCapabilityFlags,
} from './types';

export interface ToolAdapter {
  readonly type: Tool['type'];
  readonly capabilities: ToolCapabilityFlags;
  validateConfig: (tool: Tool, actionType: AdapterExecutionContext['actionType']) => string[];
  buildRequest: (input: AdapterBuildRequestInput) => ExecutionRequest;
  execute: (request: ExecutionRequest, context: AdapterExecutionContext) => Promise<RawExecutionResponse>;
  normalizeResponse: (raw: RawExecutionResponse, request: ExecutionRequest) => NormalizedExecutionResponse;
}
