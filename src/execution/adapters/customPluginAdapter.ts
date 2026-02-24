import type { ToolAdapter } from '../ToolAdapter';
import { previewText } from '../helpers';

export const customPluginAdapter: ToolAdapter = {
  type: 'custom_plugin',
  capabilities: {
    canTestConnection: true,
    canRun: true,
    supportsHeaders: false,
    supportsPayload: true,
  },
  validateConfig: () => {
    return [];
  },
  buildRequest: ({ tool, actionType, payload }) => {
    const requestBodySource = payload ?? tool.samplePayload;

    return {
      method: 'POST',
      url: `mock://custom-plugin/${tool.id}/${actionType}`,
      headers: {},
      body: requestBodySource.length > 0 ? requestBodySource : JSON.stringify({ action: actionType }),
    };
  },
  execute: async (request, context) => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 200);
    });

    if (context.actionType === 'run' && request.body?.includes('force_error')) {
      throw new Error('Custom plugin execution failed: forced error flag detected.');
    }

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, plugin: 'placeholder', request }),
    };
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
