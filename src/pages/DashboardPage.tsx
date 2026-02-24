import { Link } from 'react-router-dom';
import { PageShell } from '../components/PageShell';
import { ToolCollection } from '../features/tools/components/ToolCollection';
import { useToolRegistryStore } from '../features/tools/store/toolRegistryStore';

export function DashboardPage() {
  const tools = useToolRegistryStore((state) => state.tools);
  const dashboardLayout = useToolRegistryStore((state) => state.dashboardLayout);
  const setDashboardLayout = useToolRegistryStore((state) => state.setDashboardLayout);

  return (
    <PageShell
      title="Dashboard"
      description="Browse tool cards and switch between grid/list views."
      actions={
        <Link className="inline-flex rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500" to="/tools/new">
          Add Tool
        </Link>
      }
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">View:</span>
        <button
          className={[
            'rounded-md px-3 py-1.5 text-sm transition',
            dashboardLayout === 'grid' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700',
          ].join(' ')}
          onClick={() => {
            setDashboardLayout('grid');
          }}
          type="button"
        >
          Grid
        </button>
        <button
          className={[
            'rounded-md px-3 py-1.5 text-sm transition',
            dashboardLayout === 'list' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700',
          ].join(' ')}
          onClick={() => {
            setDashboardLayout('list');
          }}
          type="button"
        >
          List
        </button>
      </div>

      <ToolCollection layout={dashboardLayout} tools={tools} />
    </PageShell>
  );
}
