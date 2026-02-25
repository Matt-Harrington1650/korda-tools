import { NavLink, Outlet } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/tools', label: 'Tools Library', end: false },
  { to: '/registry/new', label: 'Add Tool', end: false },
  { to: '/settings', label: 'Settings', end: false },
] as const;

const getNavClassName = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
  ].join(' ');

export function AppLayout() {
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Korda Tools</h1>
          <p className="text-sm text-slate-400">Desktop-first MVP scaffold</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} className={getNavClassName} end={link.end} to={link.to}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
