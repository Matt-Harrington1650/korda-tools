import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '../components/PageShell';
import type { CreateToolInput } from '../domain/tool';
import { useToolRegistryStore } from '../features/tools/store/toolRegistryStore';
import { createToolInputSchema } from '../schemas/tool';

const defaultValues: CreateToolInput = {
  name: '',
  description: '',
  endpoint: 'https://api.example.com/new-tool',
  type: 'rest',
  status: 'healthy',
};

export function AddToolPage() {
  const navigate = useNavigate();
  const createTool = useToolRegistryStore((state) => state.createTool);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateToolInput>({
    resolver: zodResolver(createToolInputSchema),
    defaultValues,
  });

  const onSubmit = (input: CreateToolInput): void => {
    const tool = createTool(input);
    navigate(`/tools/${tool.id}`);
  };

  return (
    <PageShell title="Add Tool" description="MVP flow placeholder with typed validation and local registry write.">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Name</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-brand-500"
              {...register('name')}
              placeholder="Tool name"
            />
            <span className="text-xs text-rose-300">{errors.name?.message}</span>
          </label>

          <label className="space-y-1">
            <span className="text-sm text-slate-300">Endpoint</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-brand-500"
              {...register('endpoint')}
              placeholder="https://api.example.com"
            />
            <span className="text-xs text-rose-300">{errors.endpoint?.message}</span>
          </label>

          <label className="space-y-1">
            <span className="text-sm text-slate-300">Type</span>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-brand-500"
              {...register('type')}
            >
              <option value="rest">REST</option>
              <option value="graphql">GraphQL</option>
              <option value="webhook">Webhook</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm text-slate-300">Status</span>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-brand-500"
              {...register('status')}
            >
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="offline">Offline</option>
            </select>
          </label>
        </div>

        <label className="space-y-1">
          <span className="text-sm text-slate-300">Description</span>
          <textarea
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-brand-500"
            {...register('description')}
            placeholder="What does this tool do?"
            rows={4}
          />
          <span className="text-xs text-rose-300">{errors.description?.message}</span>
        </label>

        <button
          className="inline-flex rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          type="submit"
        >
          Save Tool
        </button>
      </form>
    </PageShell>
  );
}
