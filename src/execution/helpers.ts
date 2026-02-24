import type { Tool } from '../domain/tool';
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
  if (request.url.startsWith('mock://')) {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 120);
    });

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, source: request.url, method: request.method }),
    };
  }

  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body ?? undefined,
    signal,
  });

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    statusCode: response.status,
    headers,
    body: await response.text(),
  };
};

export const createRequestSummary = (request: ExecutionRequest): string => {
  return `${request.method} ${request.url}`;
};
