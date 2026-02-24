import type { ToolAdapter } from '../ToolAdapter';
import { previewText } from '../helpers';

const sleep = (ms: number, signal: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException('Execution cancelled.', 'AbortError'));
      return;
    }

    const handle = globalThis.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = (): void => {
      globalThis.clearTimeout(handle);
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason ?? new DOMException('Execution cancelled.', 'AbortError'));
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
};

const toAttachmentPreview = (request: Parameters<ToolAdapter['execute']>[0]) => {
  return (request.attachments ?? []).map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
  }));
};

export const customPluginAdapter: ToolAdapter = {
  type: 'custom_plugin',
  capabilities: {
    canTestConnection: true,
    canRun: true,
    supportsHeaders: false,
    supportsPayload: true,
    supportsFiles: true,
    supportsStreaming: true,
  },
  validateConfig: () => {
    return [];
  },
  buildRequest: ({ tool, actionType, payload, attachments }) => {
    const requestBodySource = payload ?? tool.samplePayload;
    const normalizedAttachments = attachments ?? [];
    const defaultBody = JSON.stringify({
      action: actionType,
      attachments: normalizedAttachments.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
      })),
    });

    return {
      method: 'POST',
      url: `mock://custom-plugin/${tool.id}/${actionType}`,
      headers: {},
      body: requestBodySource.length > 0 ? requestBodySource : defaultBody,
      attachments: normalizedAttachments,
    };
  },
  execute: async (request, context) => {
    await sleep(200, context.signal);

    if (context.actionType === 'run' && request.body?.includes('force_error')) {
      throw new Error('Custom plugin execution failed: forced error flag detected.');
    }

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        plugin: 'placeholder',
        request: {
          ...request,
          attachments: toAttachmentPreview(request),
        },
      }),
    };
  },
  executeStream: async function* (request, context) {
    yield {
      type: 'status',
      phase: 'executing',
      message: 'Starting plugin stream execution.',
    };

    await sleep(60, context.signal);
    yield {
      type: 'progress',
      progress: 25,
      message: 'Preparing plugin runtime.',
    };

    await sleep(60, context.signal);
    yield {
      type: 'chunk',
      chunk: JSON.stringify({ stage: 'runtime-ready' }),
      mimeType: 'application/json',
    };

    await sleep(80, context.signal);
    yield {
      type: 'progress',
      progress: 80,
      message: 'Executing plugin action.',
    };

    if (context.actionType === 'run' && request.body?.includes('force_error')) {
      throw new Error('Custom plugin execution failed: forced error flag detected.');
    }

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        plugin: 'placeholder',
        request: {
          ...request,
          attachments: toAttachmentPreview(request),
        },
      }),
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
