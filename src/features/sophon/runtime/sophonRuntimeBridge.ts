import { isTauriRuntime } from '../../../lib/runtime';
import { tauriInvoke } from '../../../lib/tauri';
import type { SophonRuntimeReadinessReport, SophonSystemState } from '../types';

type MethodParams = Record<string, unknown>;

interface BridgeRequest {
  method: string;
  params?: MethodParams;
}

export const isSophonRuntimeBridgeEnabled = (): boolean => isTauriRuntime();

export async function sophonRuntimeInvoke<TResult = unknown>(
  method: string,
  params: MethodParams = {},
): Promise<TResult> {
  return tauriInvoke<TResult>('sophon_runtime_invoke', {
    request: { method, params } as BridgeRequest,
  });
}

export async function sophonRuntimeState(): Promise<SophonSystemState> {
  return sophonRuntimeInvoke<SophonSystemState>('get_state');
}

export async function sophonRuntimeShutdown(): Promise<void> {
  await tauriInvoke<void>('sophon_runtime_shutdown');
}

export async function sophonRuntimeCheckReadiness(): Promise<SophonRuntimeReadinessReport> {
  return sophonRuntimeInvoke<SophonRuntimeReadinessReport>('check_readiness');
}

export async function sophonRuntimeAutoRemediate(): Promise<{
  ok: boolean;
  actions: string[];
  readiness: SophonRuntimeReadinessReport;
  state: SophonSystemState;
}> {
  return sophonRuntimeInvoke('auto_remediate');
}
