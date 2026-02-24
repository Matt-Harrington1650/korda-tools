import { NavLink, Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-64 border-r border-slate-200 bg-white p-4 md:block">
          <div className="mb-6">
            <h1 className="text-lg font-semibold">AI Tool Hub</h1>
            <p className="text-sm text-slate-500">Sidebar placeholder</p>
          </div>
          <nav className="flex flex-col gap-2">
            <NavLink
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
              }
              end
              to="/"
            >
              Dashboard
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
              }
              to="/tools/new"
            >
              Add Tool
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
              }
              to="/settings"
            >
              Settings
            </NavLink>
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex h-14 items-center border-b border-slate-200 bg-white px-4">
            <span className="text-sm font-medium text-slate-600">Top bar placeholder</span>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
