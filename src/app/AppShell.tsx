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

  const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
    `kt-nav-link ${isActive ? 'kt-nav-link-active' : ''}`;

  return (
    <div className="relative min-h-screen text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden w-[268px] flex-col border-r border-slate-700/60 bg-[color:var(--kt-bg-sidebar)] px-4 pb-6 pt-5 md:flex">
          <div className="kt-panel-muted mb-4 px-4 py-3">
            <h1 className="kt-title-lg">Korda Tools</h1>
            <p className="mt-1 text-xs text-[color:var(--kt-text-muted)]">Desktop engineering workspace</p>
          </div>

          <p className="kt-title-sm mb-2 px-1">Core Workflows</p>
          <nav className="flex flex-col gap-1.5">
            <NavLink className={navLinkClass} end to="/">
              Dashboard
            </NavLink>
            <NavLink className={navLinkClass} end to="/tools">
              Tools Library
            </NavLink>
            <NavLink className={navLinkClass} to="/tools/new">
              Add Custom Tool
            </NavLink>
            <NavLink className={navLinkClass} to="/workflows">
              Workflows
            </NavLink>
            <NavLink className={navLinkClass} to="/chat">
              Chat
            </NavLink>
            <NavLink className={navLinkClass} to="/sophon">
              Sophon
            </NavLink>
            <NavLink className={navLinkClass} to="/records">
              Records
            </NavLink>
          </nav>

          <p className="kt-title-sm mb-2 mt-5 px-1">Support</p>
          <nav className="flex flex-col gap-1.5">
            <NavLink className={navLinkClass} to="/help">
              Start Here
            </NavLink>
            <NavLink className={navLinkClass} to="/settings">
              Settings
            </NavLink>
          </nav>

          <div className="kt-panel-muted mt-auto px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[color:var(--kt-text-muted)]">
              Mode
            </p>
            <p className="mt-1 text-xs text-[color:var(--kt-text-secondary)]">Offline-first desktop runtime</p>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex h-[60px] items-center justify-between border-b border-slate-700/60 bg-[color:var(--kt-surface-1)] px-4 sm:px-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--kt-text-muted)]">
                Korda Tools
              </span>
              <p className="mt-1 text-sm text-[color:var(--kt-text-secondary)]">Operator Console</p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <span className="kt-chip">Desktop</span>
              <span className="kt-chip kt-chip-accent">Secure Local</span>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>

      {welcomeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <section className="kt-panel-elevated w-full max-w-xl space-y-4 p-6">
            <div>
              <h2 className="kt-title-xl">Welcome to Korda Tools</h2>
              <p className="mt-2 text-sm text-[color:var(--kt-text-secondary)]">
                This app manages local tool metadata, workflow automation, and versioned custom tool packages. Start with the Help Center for setup and workflow guidance.
              </p>
            </div>
            {welcomeError ? <p className="text-sm text-[color:var(--kt-danger)]">{welcomeError}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="kt-btn kt-btn-ghost"
                onClick={() => {
                  void closeWelcome();
                }}
                type="button"
              >
                Dismiss
              </button>
              <button
                className="kt-btn kt-btn-primary"
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

