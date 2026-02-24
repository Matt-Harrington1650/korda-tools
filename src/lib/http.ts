import { AppError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestJsonOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export type JsonResponse<T> = {
  status: number;
  data: T;
};

export const requestJson = async <T>(url: string, options: RequestJsonOptions = {}): Promise<JsonResponse<T>> => {
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  const rawBody = await response.text();
  let parsedBody: unknown = null;

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = rawBody;
    }
  }

  if (!response.ok) {
    throw new AppError('HTTP_ERROR', `Request failed with status ${response.status}`, parsedBody);
  }

  return {
    status: response.status,
    data: parsedBody as T,
  };
};
