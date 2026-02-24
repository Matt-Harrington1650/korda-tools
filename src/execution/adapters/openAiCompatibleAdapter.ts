import type { ToolAdapter } from '../ToolAdapter';
import { executeHttpRequest, headersToRecord, previewText } from '../helpers';

const DEFAULT_PAYLOAD = JSON.stringify({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'ping' }],
});

export const openAiCompatibleAdapter: ToolAdapter = {
  type: 'openai_compatible',
  capabilities: {
    canTestConnection: true,
    canRun: true,
    supportsHeaders: true,
    supportsPayload: true,
    supportsFiles: false,
    supportsStreaming: false,
  },
  validateConfig: (tool) => {
    if (!tool.endpoint) {
      return ['Endpoint URL is required.'];
    }

    return [];
  },
  buildRequest: ({ tool, actionType, payload }) => {
    const headers = {
      'Content-Type': 'application/json',
      ...headersToRecord(tool),
    };

    if (actionType === 'test') {
      return {
        method: 'GET',
        url: tool.endpoint,
        headers,
        body: null,
      };
    }

    const requestBodySource = payload ?? tool.samplePayload;

    return {
      method: 'POST',
      url: tool.endpoint,
      headers,
      body: requestBodySource.length > 0 ? requestBodySource : DEFAULT_PAYLOAD,
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
