import type { ToolAdapter } from '../ToolAdapter';
import { createRequestSummary, executeHttpRequest, headersToRecord, previewText } from '../helpers';

const canHaveBody = (method: string): boolean => {
  return method !== 'GET' && method !== 'DELETE';
};

export const restApiAdapter: ToolAdapter = {
  type: 'rest_api',
  capabilities: {
    canTestConnection: true,
    canRun: true,
    supportsHeaders: true,
    supportsPayload: true,
    supportsFiles: false,
    supportsStreaming: false,
  },
  validateConfig: (tool) => {
    const errors: string[] = [];

    if (!tool.endpoint) {
      errors.push('Endpoint URL is required.');
    }

    if (!tool.method) {
      errors.push('HTTP method is required.');
    }

    return errors;
  },
  buildRequest: ({ tool, actionType, payload }) => {
    const method = tool.method ?? 'GET';
    const requestBodySource = payload ?? tool.samplePayload;
    const body = canHaveBody(method) ? (requestBodySource.length > 0 ? requestBodySource : null) : null;

    const headers = {
      ...headersToRecord(tool),
    };

    if (body && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (actionType === 'test') {
      return {
        method: 'GET',
        url: tool.endpoint,
        headers,
        body: null,
      };
    }

    return {
      method,
      url: tool.endpoint,
      headers,
      body,
    };
  },
  execute: async (request, context) => {
    return executeHttpRequest(request, context.signal);
  },
  normalizeResponse: (raw, request) => {
    return {
      statusCode: raw.statusCode,
      headers: raw.headers,
      body: raw.body,
      bodyPreview: previewText(raw.body || createRequestSummary(request)),
    };
  },
};
