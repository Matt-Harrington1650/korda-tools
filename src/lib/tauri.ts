import { isTauriRuntime } from './runtime';

const assertTauriRuntime = (): void => {
  if (!isTauriRuntime()) {
    throw new Error('Tauri API is not available in web runtime.');
  }
};

export async function tauriPath(): Promise<typeof import('@tauri-apps/api/path')> {
  assertTauriRuntime();
  return import('@tauri-apps/api/path');
}

export async function tauriApp(): Promise<typeof import('@tauri-apps/api/app')> {
  assertTauriRuntime();
  return import('@tauri-apps/api/app');
}

export async function tauriCore(): Promise<typeof import('@tauri-apps/api/core')> {
  assertTauriRuntime();
  return import('@tauri-apps/api/core');
}

export async function tauriUpdater(): Promise<typeof import('@tauri-apps/plugin-updater')> {
  assertTauriRuntime();
  return import('@tauri-apps/plugin-updater');
}

export async function tauriInvoke<TResult>(
  command: string,
  args?: Record<string, unknown>,
): Promise<TResult> {
  const core = await tauriCore();
  return core.invoke<TResult>(command, args);
}
