import { useMemo, useState } from 'react';
import { useSophonStore } from '../../features/sophon/store/sophonStore';

export function SophonPoliciesAuditPage() {
  const [filter, setFilter] = useState('');
  const state = useSophonStore((store) => store.state);
  const setRole = useSophonStore((store) => store.setRole);
  const recordBlockedEgressAttempt = useSophonStore((store) => store.recordBlockedEgressAttempt);

  const filteredAudit = useMemo(() => {
    const token = filter.trim().toLowerCase();
    if (!token) {
      return state.audit;
    }
    return state.audit.filter((item) => {
      return (
        item.action.toLowerCase().includes(token) ||
        item.entityType.toLowerCase().includes(token) ||
        item.details.toLowerCase().includes(token)
      );
    });
  }, [filter, state.audit]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-1">
        <h3 className="text-base font-semibold text-slate-900">Policy Controls</h3>
        <div className="mt-3 space-y-2 text-sm">
          <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
            Offline-only enforcement: {state.offlineOnlyEnforced ? 'Enabled' : 'Disabled'}
          </p>
          <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
            Outbound egress block: {state.egressBlocked ? 'Enabled' : 'Disabled'}
          </p>
          <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
            Cross-client mixing prevention: {state.crossClientMixingPrevented ? 'Enabled' : 'Disabled'}
          </p>
          <button
            className="w-full rounded border border-blue-300 px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50"
            onClick={() => {
              recordBlockedEgressAttempt('https://example.com', 'SOPHON_EGRESS_BLOCK_REQUIRED');
            }}
            type="button"
          >
            Simulate blocked egress event
          </button>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium uppercase text-slate-600">Active Role</p>
          <div className="mt-2 grid gap-2">
            {(['admin', 'operator', 'viewer'] as const).map((role) => (
              <button
                key={role}
                className={[
                  'rounded border px-3 py-2 text-left text-sm',
                  state.role === role
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                ].join(' ')}
                onClick={() => {
                  setRole(role);
                }}
                type="button"
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">Audit Trail</h3>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm sm:w-64"
            onChange={(event) => {
              setFilter(event.target.value);
            }}
            placeholder="Filter audit entries"
            value={filter}
          />
        </div>
        <div className="mt-3 space-y-2">
          {filteredAudit.length === 0 ? (
            <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              No matching audit events.
            </p>
          ) : null}
          {filteredAudit.slice(0, 120).map((event) => (
            <article key={event.id} className="rounded border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{event.action}</p>
                <span
                  className={[
                    'rounded px-2 py-1 text-xs font-medium uppercase',
                    event.severity === 'info' ? 'bg-blue-100 text-blue-700' : '',
                    event.severity === 'warn' ? 'bg-amber-100 text-amber-700' : '',
                    event.severity === 'error' ? 'bg-rose-100 text-rose-700' : '',
                  ].join(' ')}
                >
                  {event.severity}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {event.entityType}:{event.entityId} - {new Date(event.eventTsUtc).toLocaleString()} - actor{' '}
                {event.actorId}
              </p>
              <p className="mt-2 text-sm text-slate-700">{event.details}</p>
            </article>
          ))}
        </div>

        <h4 className="mt-4 text-sm font-semibold text-slate-900">Blocked Egress Evidence</h4>
        <div className="mt-2 space-y-2">
          {state.blockedEgressAttempts.length === 0 ? (
            <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              No blocked egress attempts recorded.
            </p>
          ) : null}
          {state.blockedEgressAttempts.slice(0, 20).map((item) => (
            <article key={item.id} className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <p className="font-medium">{item.attemptedTarget}</p>
              <p>{item.reason}</p>
              <p>{new Date(item.blockedAt).toLocaleString()}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
