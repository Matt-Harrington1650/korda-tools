import type { Tool } from '../domain/tool';
import { governedExecutionGateway } from '../services/execution/GovernedExecutionGateway';
import type { ExecutionRequest, RawExecutionResponse } from './types';

const PREVIEW_LENGTH = 800;

export const headersToRecord = (tool: Tool): Record<string, string> => {
  return tool.headers.reduce<Record<string, string>>((accumulator, header) => {
    if (header.key) {
      accumulator[header.key] = header.value;
    }

    return accumulator;
  }, {});
};

export const previewText = (value: string): string => {
  if (value.length <= PREVIEW_LENGTH) {
    return value;
  }

  return `${value.slice(0, PREVIEW_LENGTH)}...`;
};

export const executeHttpRequest = async (
  request: ExecutionRequest,
  signal: AbortSignal,
): Promise<RawExecutionResponse> => {
  return governedExecutionGateway.execute(request, signal);
};

export const createRequestSummary = (request: ExecutionRequest): string => {
  if (!request.attachments || request.attachments.length === 0) {
    return `${request.method} ${request.url}`;
  }

  const fileNames = request.attachments.map((attachment) => attachment.name).join(', ');
  return `${request.method} ${request.url} (files: ${request.attachments.length} - ${fileNames})`;
};
