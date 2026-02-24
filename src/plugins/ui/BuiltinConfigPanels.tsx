import type { PluginConfigPanelProps } from '../PluginManifest';

type HeaderRow = {
  key: string;
  value: string;
};

const toStringValue = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const toHeaderRows = (value: unknown): HeaderRow[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      return {
        key: toStringValue(record.key),
        value: toStringValue(record.value),
      };
    })
    .filter((entry): entry is HeaderRow => entry !== null);
};

const withField = (value: Record<string, unknown>, key: string, next: unknown): Record<string, unknown> => {
  return {
    ...value,
    [key]: next,
  };
};

const HeaderRowsEditor = ({
  value,
  onChange,
  disabled,
}: PluginConfigPanelProps) => {
  const headers = toHeaderRows(value.headers);
  const nextHeaders = headers.length > 0 ? headers : [{ key: '', value: '' }];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Headers</span>
        <button
          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-70"
          disabled={disabled}
          onClick={() => {
            onChange(withField(value, 'headers', [...headers, { key: '', value: '' }]));
          }}
          type="button"
        >
          Add Header
        </button>
      </div>
      {nextHeaders.map((header, index) => (
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]" key={`${index}-${header.key}`}>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
            onChange={(event) => {
              const updated = [...nextHeaders];
              updated[index] = {
                ...updated[index],
                key: event.target.value,
              };
              onChange(withField(value, 'headers', updated));
            }}
            placeholder="Header key"
            value={header.key}
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
            onChange={(event) => {
              const updated = [...nextHeaders];
              updated[index] = {
                ...updated[index],
                value: event.target.value,
              };
              onChange(withField(value, 'headers', updated));
            }}
            placeholder="Header value"
            value={header.value}
          />
          <button
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-70"
            disabled={disabled}
            onClick={() => {
              const updated = nextHeaders.filter((_, itemIndex) => itemIndex !== index);
              onChange(withField(value, 'headers', updated));
            }}
            type="button"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};

const ErrorList = ({ errors }: { errors?: string[] }) => {
  if (!errors || errors.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-1 text-xs text-rose-600">
      {errors.map((message, index) => (
        <li key={`${message}-${index}`}>{message}</li>
      ))}
    </ul>
  );
};

export const RestApiConfigPanel = ({ value, onChange, disabled, errors }: PluginConfigPanelProps) => {
  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-4">
      <h4 className="text-sm font-semibold text-slate-900">REST API Configuration</h4>
      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-700">Endpoint URL</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
          onChange={(event) => {
            onChange(withField(value, 'endpoint', event.target.value));
          }}
          placeholder="https://api.example.com/resource"
          value={toStringValue(value.endpoint)}
        />
      </label>

      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-700">Method</span>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
          onChange={(event) => {
            onChange(withField(value, 'method', event.target.value));
          }}
          value={toStringValue(value.method, 'GET')}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
      </label>

      <HeaderRowsEditor disabled={disabled} onChange={onChange} value={value} />

      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-700">Sample Payload</span>
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
          onChange={(event) => {
            onChange(withField(value, 'samplePayload', event.target.value));
          }}
          rows={4}
          value={toStringValue(value.samplePayload)}
        />
      </label>

      <ErrorList errors={errors} />
    </div>
  );
};

export const OpenAiCompatibleConfigPanel = ({ value, onChange, disabled, errors }: PluginConfigPanelProps) => {
  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-4">
      <h4 className="text-sm font-semibold text-slate-900">OpenAI-Compatible Configuration</h4>
      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-700">Endpoint URL</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
          onChange={(event) => {
            onChange(withField(value, 'endpoint', event.target.value));
          }}
          placeholder="https://api.openai-compatible.com/v1/chat/completions"
          value={toStringValue(value.endpoint)}
        />
      </label>

      <HeaderRowsEditor disabled={disabled} onChange={onChange} value={value} />

      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-700">Sample Payload</span>
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
          onChange={(event) => {
            onChange(withField(value, 'samplePayload', event.target.value));
          }}
          rows={4}
          value={toStringValue(value.samplePayload)}
        />
      </label>

      <ErrorList errors={errors} />
    </div>
  );
};

export const WebhookConfigPanel = ({ value, onChange, disabled, errors }: PluginConfigPanelProps) => {
  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-4">
      <h4 className="text-sm font-semibold text-slate-900">Webhook Configuration</h4>
      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-700">Endpoint URL</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
          onChange={(event) => {
            onChange(withField(value, 'endpoint', event.target.value));
          }}
          placeholder="https://hooks.example.com/trigger"
          value={toStringValue(value.endpoint)}
        />
      </label>

      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-700">Method</span>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
          onChange={(event) => {
            onChange(withField(value, 'method', event.target.value));
          }}
          value={toStringValue(value.method, 'POST')}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
      </label>

      <HeaderRowsEditor disabled={disabled} onChange={onChange} value={value} />

      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-700">Sample Payload</span>
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
          onChange={(event) => {
            onChange(withField(value, 'samplePayload', event.target.value));
          }}
          rows={4}
          value={toStringValue(value.samplePayload)}
        />
      </label>

      <ErrorList errors={errors} />
    </div>
  );
};

export const CustomPluginConfigPanel = ({ value, onChange, disabled, errors }: PluginConfigPanelProps) => {
  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-4">
      <h4 className="text-sm font-semibold text-slate-900">Custom Plugin Configuration</h4>
      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-700">Endpoint URL</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
          onChange={(event) => {
            onChange(withField(value, 'endpoint', event.target.value));
          }}
          placeholder="https://plugin.local/placeholder"
          value={toStringValue(value.endpoint, 'https://plugin.local/placeholder')}
        />
      </label>

      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-700">Sample Payload</span>
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
          onChange={(event) => {
            onChange(withField(value, 'samplePayload', event.target.value));
          }}
          rows={4}
          value={toStringValue(value.samplePayload)}
        />
      </label>

      <ErrorList errors={errors} />
    </div>
  );
};
