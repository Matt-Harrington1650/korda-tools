import { NavLink, Outlet } from 'react-router-dom';
import { useSophonStore } from '../../features/sophon/store/sophonStore';

const SOPHON_TABS = [
  { to: '/sophon/dashboard', label: 'Dashboard' },
  { to: '/sophon/sources', label: 'Sources' },
  { to: '/sophon/ingestion-jobs', label: 'Ingestion Jobs' },
  { to: '/sophon/index', label: 'Index' },
  { to: '/sophon/retrieval-lab', label: 'Retrieval Lab' },
  { to: '/sophon/models-tuning', label: 'Models & Tuning' },
  { to: '/sophon/policies-audit', label: 'Policies & Audit' },
  { to: '/sophon/backup-restore', label: 'Backup/Restore' },
  { to: '/sophon/settings', label: 'Settings' },
] as const;

const navClass = ({ isActive }: { isActive: boolean }): string => {
  return [
    'rounded-md px-3 py-2 text-xs font-medium transition-colors',
    isActive
      ? 'bg-blue-700 text-white shadow-sm'
      : 'border border-blue-100 bg-white text-blue-700 hover:bg-blue-50',
  ].join(' ');
};

export function SophonLayout() {
  const state = useSophonStore((store) => store.state);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-blue-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Sophon</h2>
            <p className="text-sm text-slate-600">
              Offline knowledge intelligence module embedded inside KORDA Tools.
            </p>
          </div>
          <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-4">
            <div className="rounded border border-blue-200 bg-white px-3 py-2">
              <p className="font-medium text-slate-900">Runtime</p>
              <p className="capitalize">{state.runtime.status}</p>
            </div>
            <div className="rounded border border-blue-200 bg-white px-3 py-2">
              <p className="font-medium text-slate-900">Queue</p>
              <p>{state.runtime.queueDepth}</p>
            </div>
            <div className="rounded border border-blue-200 bg-white px-3 py-2">
              <p className="font-medium text-slate-900">Index Docs</p>
              <p>{state.index.docCount}</p>
            </div>
            <div className="rounded border border-blue-200 bg-white px-3 py-2">
              <p className="font-medium text-slate-900">Egress Blocks</p>
              <p>{state.blockedEgressAttempts.length}</p>
            </div>
          </div>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2">
        {SOPHON_TABS.map((tab) => (
          <NavLink key={tab.to} className={navClass} to={tab.to}>
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
