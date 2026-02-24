import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { addToolFormSchema, type AddToolFormValues } from '../features/tools/forms';
import { useToolRegistryStore } from '../features/tools/store/toolRegistryStore';

const defaultValues: AddToolFormValues = {
  name: '',
  description: '',
  category: 'general',
  toolType: 'rest_api',
  endpointUrl: '',
  authType: 'none',
  method: 'GET',
  headers: [{ key: '', value: '' }],
  samplePayload: '',
  tags: '',
};

export function AddToolPage() {
  const navigate = useNavigate();
  const addTool = useToolRegistryStore((state) => state.addTool);

  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddToolFormValues>({
    resolver: zodResolver(addToolFormSchema),
    defaultValues,
  });

  const headersFieldArray = useFieldArray({
    control,
    name: 'headers',
  });

  const selectedToolType = watch('toolType');
  const needsEndpoint = selectedToolType !== 'custom_plugin';
  const needsMethod = selectedToolType === 'rest_api' || selectedToolType === 'webhook';

  const onSubmit = (values: AddToolFormValues): void => {
    const parsedTags = values.tags
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const headers = values.headers
      .map((item) => ({
        key: item.key.trim(),
        value: item.value.trim(),
      }))
      .filter((item) => item.key && item.value);

    addTool({
      name: values.name.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
      type: values.toolType,
      endpoint: values.endpointUrl.trim() || 'https://plugin.local/placeholder',
      authType: values.authType,
      method: needsMethod ? values.method : null,
      headers,
      samplePayload: values.samplePayload.trim(),
      tags: parsedTags,
      status: 'configured',
    });

    navigate('/');
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Add Tool</h2>
      <p className="mt-1 text-sm text-slate-600">Create a tool entry and save it to the local registry.</p>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
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
          <span className="text-sm font-medium text-slate-700">Endpoint URL</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder={needsEndpoint ? 'https://api.example.com/endpoint' : 'Not required for custom plugin'}
            {...register('endpointUrl')}
          />
          <p className="text-xs text-rose-600">{errors.endpointUrl?.message}</p>
          {!needsEndpoint ? <p className="text-xs text-slate-500">Custom plugins can omit endpoint URL.</p> : null}
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

          <div className="space-y-2">
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
                <p className="text-xs text-rose-600">{errors.headers?.[index]?.key?.message}</p>
                <p className="text-xs text-rose-600">{errors.headers?.[index]?.value?.message}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Tags</span>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="tag1, tag2" {...register('tags')} />
            <p className="text-xs text-slate-500">Comma-separated values.</p>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Sample Payload (optional JSON)</span>
            <textarea className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={4} {...register('samplePayload')} />
            <p className="text-xs text-rose-600">{errors.samplePayload?.message}</p>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            Save Tool
          </button>
        </div>
      </form>
    </section>
  );
}
