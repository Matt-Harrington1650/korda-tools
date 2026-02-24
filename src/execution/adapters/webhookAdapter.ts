import type { ToolAdapter } from '../ToolAdapter';
import { executeHttpRequest, headersToRecord, previewText } from '../helpers';

export const webhookAdapter: ToolAdapter = {
  type: 'webhook',
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

    return errors;
  },
  buildRequest: ({ tool, actionType, payload }) => {
    const headers = {
      'Content-Type': 'application/json',
      ...headersToRecord(tool),
    };

    if (actionType === 'test') {
      return {
        method: 'POST',
        url: tool.endpoint,
        headers,
        body: JSON.stringify({ event: 'test.connection' }),
      };
    }

    const requestBodySource = payload ?? tool.samplePayload;

    return {
      method: tool.method ?? 'POST',
      url: tool.endpoint,
      headers,
      body: requestBodySource.length > 0 ? requestBodySource : JSON.stringify({ event: 'manual.run' }),
    };
  },
  execute: async (request, context) => {
    return executeHttpRequest(request, context.signal);
  },
  normalizeResponse: (raw) => {
    return {
      statusCode: raw.statusCode,
      headers: raw.headers,
      body: raw.body,
      bodyPreview: previewText(raw.body),
    };
  },
};
