import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers';
import './index.css';
import { isTauriRuntime } from './lib/runtime';
import { startDesktopScheduler } from './features/workflows/scheduler';

if (import.meta.env.DEV) {
  console.info(`[runtime] ${isTauriRuntime() ? 'tauri' : 'web'}`);
}

if (isTauriRuntime()) {
  startDesktopScheduler();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);
