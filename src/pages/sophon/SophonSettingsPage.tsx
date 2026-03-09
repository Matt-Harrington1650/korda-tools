import { useState } from 'react';
import { useSophonStore } from '../../features/sophon/store/sophonStore';

export function SophonSettingsPage() {
  const state = useSophonStore((store) => store.state);
  const runHealthCheck = useSophonStore((store) => store.runHealthCheck);
  const recordBlockedEgressAttempt = useSophonStore((store) => store.recordBlockedEgressAttempt);
  const [message, setMessage] = useState('');

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">Sophon Advanced Settings</h3>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          Offline-only lock: {state.offlineOnlyEnforced ? 'Enabled' : 'Disabled'}
        </p>
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          Egress block: {state.egressBlocked ? 'Enabled' : 'Disabled'}
        </p>
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          Engine mode: {state.runtime.engineMode}
        </p>
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          Transport: {state.runtime.transport}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          onClick={() => {
            runHealthCheck();
            setMessage('Runtime health + telemetry cache refreshed.');
          }}
          type="button"
        >
          Refresh Runtime Cache
        </button>
        <button
          className="rounded border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          onClick={() => {
            recordBlockedEgressAttempt('https://blocked.invalid', 'SOPHON_EGRESS_BLOCK_REQUIRED');
            setMessage('Synthetic blocked-egress evidence recorded.');
          }}
          type="button"
        >
          Test Offline Gate
        </button>
      </div>
      {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}
