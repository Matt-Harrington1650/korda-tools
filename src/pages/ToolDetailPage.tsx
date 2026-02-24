import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getToolAdapter } from '../adapters/toolAdapters';
import { EmptyState } from '../components/EmptyState';
import { PageShell } from '../components/PageShell';
import { formatTimestamp } from '../lib/dates';
import { useToolRegistryStore } from '../features/tools/store/toolRegistryStore';

export function ToolDetailPage() {
  const navigate = useNavigate();
  const { toolId } = useParams<{ toolId: string }>();
  const getToolById = useToolRegistryStore((state) => state.getToolById);
  const updateTool = useToolRegistryStore((state) => state.updateTool);
  const deleteTool = useToolRegistryStore((state) => state.deleteTool);

  const tool = toolId ? getToolById(toolId) : undefined;

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      if (!tool) {
        throw new Error('Tool not found');
      }

      const adapter = getToolAdapter(tool.type);
      if (!adapter) {
        throw new Error(`No adapter configured for tool type: ${tool.type}`);
      }

      return adapter.testConnection(tool);
    },
  });

  if (!tool) {
    return (
      <PageShell title="Tool Detail" description="Placeholder detail view for tool metadata and execution health.">
        <EmptyState
          title="Tool not found"
          message="This tool may have been deleted or the URL is invalid."
          action={
            <Link className="inline-flex rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500" to="/">
              Back to Dashboard
            </Link>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell title={tool.name} description="Tool detail placeholder with mock connection test.">
      <div className="grid gap-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Type</p>
          <p className="text-sm text-slate-100">{tool.type}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
          <p className="text-sm text-slate-100">{tool.status}</p>
        </div>
        <div className="md:col-span-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Endpoint</p>
          <p className="text-sm text-slate-100">{tool.endpoint}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Created</p>
          <p className="text-sm text-slate-100">{formatTimestamp(tool.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Updated</p>
          <p className="text-sm text-slate-100">{formatTimestamp(tool.updatedAt)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={testConnectionMutation.isPending}
          onClick={() => {
            testConnectionMutation.mutate();
          }}
          type="button"
        >
          {testConnectionMutation.isPending ? 'Testing...' : 'Run Mock Test'}
        </button>

        <button
          className="rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
          onClick={() => {
            updateTool(tool.id, { status: 'healthy' });
          }}
          type="button"
        >
          Mark Healthy
        </button>

        <button
          className="rounded-md bg-rose-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-600"
          onClick={() => {
            deleteTool(tool.id);
            navigate('/');
          }}
          type="button"
        >
          Delete Tool
        </button>
      </div>

      {testConnectionMutation.isSuccess ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {testConnectionMutation.data.message} ({testConnectionMutation.data.latencyMs} ms)
        </p>
      ) : null}

      {testConnectionMutation.isError ? (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {testConnectionMutation.error instanceof Error
            ? testConnectionMutation.error.message
            : 'Connection test failed.'}
        </p>
      ) : null}
    </PageShell>
  );
}
