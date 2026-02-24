import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { EmptyState } from '../components/EmptyState';
import { useToolRegistryStore } from '../features/tools/store/toolRegistryStore';
import { authTypeSchema, httpMethodSchema, toolStatusSchema, toolTypeSchema } from '../schemas/tool';

const toolDetailFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(240),
  category: z.string().trim().min(1, 'Category is required').max(40),
  toolType: toolTypeSchema,
  endpointUrl: z.string().trim().url('Endpoint URL must be valid'),
  authType: authTypeSchema,
  method: httpMethodSchema.nullable(),
  headers: z.array(z.object({ key: z.string().trim(), value: z.string().trim() })),
  samplePayload: z.string().trim(),
  tags: z.string().trim(),
  status: toolStatusSchema,
});

type ToolDetailFormValues = z.infer<typeof toolDetailFormSchema>;

const toTagText = (tags: string[]): string => tags.join(', ');

export function ToolDetailPage() {
  const navigate = useNavigate();
  const { toolId } = useParams<{ toolId: string }>();
  const getToolById = useToolRegistryStore((state) => state.getToolById);
  const updateTool = useToolRegistryStore((state) => state.updateTool);
  const deleteTool = useToolRegistryStore((state) => state.deleteTool);

  const tool = toolId ? getToolById(toolId) : undefined;

  const {
    register,
    control,
    watch,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ToolDetailFormValues>({
    resolver: zodResolver(toolDetailFormSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
      toolType: 'rest_api',
      endpointUrl: 'https://api.example.com',
      authType: 'none',
      method: 'GET',
      headers: [{ key: '', value: '' }],
      samplePayload: '',
      tags: '',
      status: 'configured',
    },
  });

  const headersFieldArray = useFieldArray({
    control,
    name: 'headers',
  });

  useEffect(() => {
    if (!tool) {
      return;
    }

    reset({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      toolType: tool.type,
      endpointUrl: tool.endpoint,
      authType: tool.authType,
      method: tool.method,
      headers: tool.headers.length ? tool.headers : [{ key: '', value: '' }],
      samplePayload: tool.samplePayload,
      tags: toTagText(tool.tags),
      status: tool.status,
    });
  }, [reset, tool]);

  const selectedToolType = watch('toolType');
  const needsMethod = selectedToolType === 'rest_api' || selectedToolType === 'webhook';

  const onSubmit = (values: ToolDetailFormValues): void => {
    if (!tool) {
      return;
    }

    updateTool(tool.id, {
      name: values.name.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
      type: values.toolType,
      endpoint: values.endpointUrl.trim(),
      authType: values.authType,
      method: needsMethod ? values.method : null,
      headers: values.headers
        .map((header) => ({ key: header.key.trim(), value: header.value.trim() }))
        .filter((header) => header.key.length > 0 && header.value.length > 0),
      samplePayload: values.samplePayload.trim(),
      tags: values.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      status: values.status,
    });
  };

  const handleDelete = (): void => {
    if (!tool) {
      return;
    }

    const confirmed = window.confirm(`Delete tool "${tool.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    deleteTool(tool.id);
    navigate('/');
  };

  if (!toolId) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Invalid tool route</h2>
        <p className="mt-2 text-sm text-slate-600">Tool ID was not provided in the URL.</p>
      </section>
    );
  }

  if (!tool) {
    return (
      <EmptyState
        action={
          <Link className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800" to="/">
            Back to Dashboard
          </Link>
        }
        message="This tool does not exist or was removed."
        title="Tool not found"
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{tool.name}</h2>
            <p className="text-sm text-slate-600">Edit configuration and manage this tool.</p>
          </div>
          <button
            className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500"
            onClick={handleDelete}
            type="button"
          >
            Delete Tool
          </button>
        </div>

        <h3 className="mb-3 text-base font-semibold text-slate-900">Configuration</h3>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('name')} />
              <p className="text-xs text-rose-600">{errors.name?.message}</p>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Category</span>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('category')} />
              <p className="text-xs text-rose-600">{errors.category?.message}</p>
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={3} {...register('description')} />
            <p className="text-xs text-rose-600">{errors.description?.message}</p>
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Tool Type</span>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('toolType')}>
                <option value="rest_api">REST API</option>
                <option value="openai_compatible">OpenAI-compatible</option>
                <option value="webhook">Webhook</option>
                <option value="custom_plugin">Custom plugin</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Auth Type</span>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('authType')}>
                <option value="none">None</option>
                <option value="api_key">API Key</option>
                <option value="bearer">Bearer</option>
                <option value="custom_header">Custom Header</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('status')}>
                <option value="configured">Configured</option>
                <option value="missing_credentials">Missing credentials</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Endpoint URL</span>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('endpointUrl')} />
              <p className="text-xs text-rose-600">{errors.endpointUrl?.message}</p>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Method</span>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('method')}>
                <option value="">Select</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
              <p className="text-xs text-rose-600">{errors.method?.message}</p>
              {!needsMethod ? <p className="text-xs text-slate-500">Optional for this tool type.</p> : null}
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Tags</span>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('tags')} />
            <p className="text-xs text-slate-500">Comma-separated tags.</p>
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Headers</span>
              <button
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                onClick={() => {
                  headersFieldArray.append({ key: '', value: '' });
                }}
                type="button"
              >
                Add Header
              </button>
            </div>

            {headersFieldArray.fields.map((field, index) => (
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]" key={field.id}>
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Header key"
                  {...register(`headers.${index}.key`)}
                />
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Header value"
                  {...register(`headers.${index}.value`)}
                />
                <button
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                  onClick={() => {
                    headersFieldArray.remove(index);
                  }}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Sample Payload (JSON text)</span>
            <textarea className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={4} {...register('samplePayload')} />
            <p className="text-xs text-slate-500">Optional sample body used by execution adapters.</p>
          </label>

          <button
            className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            Save Changes
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">Execution</h3>
        <p className="mt-1 text-sm text-slate-600">Execution controls will be wired to adapter pipeline in the next step.</p>
        <div className="mt-3 flex items-center gap-2">
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" type="button">
            Test Connection
          </button>
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" type="button">
            Run Tool
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">Request / Response Logs</h3>
        <p className="mt-1 text-sm text-slate-600">No runs recorded yet.</p>
      </section>
    </div>
  );
}
