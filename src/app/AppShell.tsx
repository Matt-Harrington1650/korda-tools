import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { helpCenterService } from '../features/helpCenter/service';
import { SHOW_WELCOME_MODAL_EVENT } from '../features/helpCenter/welcome';

export function AppShell() {
  const navigate = useNavigate();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeError, setWelcomeError] = useState('');

  useEffect(() => {
    let mounted = true;
    void helpCenterService
      .getAppState('welcome_dismissed')
      .then((value) => {
        if (!mounted) {
          return;
        }
        setWelcomeOpen(value?.toLowerCase() !== 'true');
      })
      .catch(() => {
        if (mounted) {
          setWelcomeOpen(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleShowWelcome = (): void => {
      setWelcomeOpen(true);
    };

    window.addEventListener(SHOW_WELCOME_MODAL_EVENT, handleShowWelcome);
    return () => {
      window.removeEventListener(SHOW_WELCOME_MODAL_EVENT, handleShowWelcome);
    };
  }, []);

  const closeWelcome = async (): Promise<void> => {
    setWelcomeError('');
    try {
      await helpCenterService.setAppState('welcome_dismissed', 'true');
      setWelcomeOpen(false);
    } catch (error) {
      setWelcomeError(error instanceof Error ? error.message : 'Failed to persist welcome state.');
    }
  };

  const openStartHere = async (): Promise<void> => {
    setWelcomeError('');
    try {
      await helpCenterService.setAppState('welcome_dismissed', 'true');
      setWelcomeOpen(false);
      navigate('/help/introduction');
    } catch (error) {
      setWelcomeError(error instanceof Error ? error.message : 'Failed to open Start Here.');
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-64 border-r border-slate-200 bg-white p-4 md:block">
          <div className="mb-6">
            <h1 className="text-lg font-semibold">Korda Tools</h1>
            <p className="text-sm text-slate-500">Local, offline-first workspace</p>
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
              end
              to="/tools"
            >
              Tools Library
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
              }
              to="/tools/new"
            >
              Add Custom Tool
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
              }
              to="/workflows"
            >
              Workflows
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
              }
              to="/chat"
            >
              Chat
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
              }
              to="/help"
            >
              Start Here
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
            <span className="text-sm font-medium text-slate-600">AI Tool Hub Desktop</span>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>

      {welcomeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <section className="w-full max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Welcome to AI Tool Hub</h2>
              <p className="mt-2 text-sm text-slate-600">
                This app manages local tool metadata, workflow automation, and versioned custom tool packages. Start with the Help Center for setup and workflow guidance.
              </p>
            </div>
            {welcomeError ? <p className="text-sm text-rose-700">{welcomeError}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  void closeWelcome();
                }}
                type="button"
              >
                Dismiss
              </button>
              <button
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                onClick={() => {
                  void openStartHere();
                }}
                type="button"
              >
                Open Start Here
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
