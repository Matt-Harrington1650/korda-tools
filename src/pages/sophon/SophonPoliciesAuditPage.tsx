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
      <section className="kt-panel p-4 lg:col-span-1">
        <h3 className="kt-title-lg">Policy Controls</h3>
        <div className="mt-3 space-y-2 text-sm">
          <p className="kt-panel-muted border-emerald-400/40 px-3 py-2 text-[color:var(--kt-success)]">
            Offline-only enforcement: {state.offlineOnlyEnforced ? 'Enabled' : 'Disabled'}
          </p>
          <p className="kt-panel-muted border-emerald-400/40 px-3 py-2 text-[color:var(--kt-success)]">
            Outbound egress block: {state.egressBlocked ? 'Enabled' : 'Disabled'}
          </p>
          <p className="kt-panel-muted border-emerald-400/40 px-3 py-2 text-[color:var(--kt-success)]">
            Cross-client mixing prevention: {state.crossClientMixingPrevented ? 'Enabled' : 'Disabled'}
          </p>
          <button
            className="kt-btn kt-btn-secondary w-full justify-start"
            onClick={() => {
              recordBlockedEgressAttempt('https://example.com', 'SOPHON_EGRESS_BLOCK_REQUIRED');
            }}
            type="button"
          >
            Simulate blocked egress event
          </button>
        </div>
        <div className="mt-4">
          <p className="kt-title-sm">Active Role</p>
          <div className="mt-2 grid gap-2">
            {(['admin', 'operator', 'viewer'] as const).map((role) => (
              <button
                key={role}
                className={[
                  'kt-btn w-full justify-start',
                  state.role === role
                    ? 'kt-btn-secondary'
                    : 'kt-btn-ghost',
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

      <section className="kt-panel p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="kt-title-lg">Audit Trail</h3>
          <input
            className="kt-input w-full sm:w-64"
            onChange={(event) => {
              setFilter(event.target.value);
            }}
            placeholder="Filter audit entries"
            value={filter}
          />
        </div>
        <div className="mt-3 space-y-2">
          {filteredAudit.length === 0 ? (
            <p className="kt-panel-muted border-dashed px-3 py-2 text-sm text-[color:var(--kt-text-muted)]">
              No matching audit events.
            </p>
          ) : null}
          {filteredAudit.slice(0, 120).map((event) => (
            <article key={event.id} className="kt-panel-muted p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[color:var(--kt-text-primary)]">{event.action}</p>
                <span
                  className={[
                    'kt-status',
                    event.severity === 'info' ? 'kt-status-info' : '',
                    event.severity === 'warn' ? 'kt-status-warn' : '',
                    event.severity === 'error' ? 'kt-status-fail' : '',
                  ].join(' ')}
                >
                  {event.severity}
                </span>
              </div>
              <p className="mt-1 text-xs text-[color:var(--kt-text-muted)]">
                {event.entityType}:{event.entityId} - {new Date(event.eventTsUtc).toLocaleString()} - actor{' '}
                {event.actorId}
              </p>
              <p className="mt-2 text-sm text-[color:var(--kt-text-secondary)]">{event.details}</p>
            </article>
          ))}
        </div>

        <h4 className="mt-4 text-sm font-semibold text-[color:var(--kt-text-primary)]">Blocked Egress Evidence</h4>
        <div className="mt-2 space-y-2">
          {state.blockedEgressAttempts.length === 0 ? (
            <p className="kt-panel-muted border-dashed px-3 py-2 text-sm text-[color:var(--kt-text-muted)]">
              No blocked egress attempts recorded.
            </p>
          ) : null}
          {state.blockedEgressAttempts.slice(0, 20).map((item) => (
            <article key={item.id} className="kt-panel-muted border-amber-400/40 p-2 text-xs text-[color:var(--kt-warning)]">
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
