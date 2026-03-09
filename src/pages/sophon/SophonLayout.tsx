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
  return `kt-tab ${isActive ? 'kt-tab-active' : ''}`;
};

export function SophonLayout() {
  const state = useSophonStore((store) => store.state);

  return (
    <div className="space-y-4">
      <section className="kt-panel-elevated p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="kt-title-xl">Sophon</h2>
            <p className="mt-1 text-sm text-[color:var(--kt-text-secondary)]">
              Knowledge ingestion, indexing, and retrieval for offline-first engineering workflows.
            </p>
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-4">
            <div className="kt-kv">
              <p className="kt-title-sm">Runtime</p>
              <p className="mt-1 text-sm font-semibold capitalize text-[color:var(--kt-text-primary)]">{state.runtime.status}</p>
            </div>
            <div className="kt-kv">
              <p className="kt-title-sm">Queue</p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--kt-text-primary)]">{state.runtime.queueDepth}</p>
            </div>
            <div className="kt-kv">
              <p className="kt-title-sm">Index Docs</p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--kt-text-primary)]">{state.index.docCount}</p>
            </div>
            <div className="kt-kv">
              <p className="kt-title-sm">Egress Blocks</p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--kt-text-primary)]">{state.blockedEgressAttempts.length}</p>
            </div>
          </div>
        </div>
      </section>

      <nav className="kt-panel flex flex-wrap gap-2 p-3">
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
