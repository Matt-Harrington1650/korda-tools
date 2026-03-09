import { useSophonStore } from '../../features/sophon/store/sophonStore';

export function SophonDashboardPage() {
  const state = useSophonStore((store) => store.state);
  const startRuntime = useSophonStore((store) => store.startRuntime);
  const stopRuntime = useSophonStore((store) => store.stopRuntime);
  const runHealthCheck = useSophonStore((store) => store.runHealthCheck);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="kt-panel p-4 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="kt-title-lg">System Health</h3>
          <div className="flex gap-2">
            <button
              className="kt-btn kt-btn-secondary"
              onClick={() => {
                runHealthCheck();
              }}
              type="button"
            >
              Refresh
            </button>
            <button
              className="kt-btn kt-btn-primary"
              onClick={() => {
                startRuntime();
              }}
              type="button"
            >
              Start
            </button>
            <button
              className="kt-btn kt-btn-ghost"
              onClick={() => {
                stopRuntime();
              }}
              type="button"
            >
              Stop
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Runtime Status" value={state.runtime.status} />
          <StatCard label="Transport" value={state.runtime.transport} />
          <StatCard label="GPU Available" value={state.runtime.gpuAvailable ? 'Yes' : 'No'} />
          <StatCard label="Model Loaded" value={state.runtime.modelLoaded ? 'Yes' : 'No'} />
          <StatCard label="Vector Store" value={state.runtime.vectorStoreReady ? 'Ready' : 'Not Ready'} />
          <StatCard label="Disk Usage" value={`${state.runtime.diskUsagePct}%`} />
          <StatCard label="Queue Depth" value={String(state.runtime.queueDepth)} />
          <StatCard label="Active Workers" value={String(state.runtime.activeWorkers)} />
          <StatCard label="Integrity" value={state.index.integrityStatus} />
        </div>
      </section>

      <section className="kt-panel p-4">
        <h3 className="kt-title-lg">Latency + Throughput</h3>
        <div className="mt-3 space-y-2 text-sm text-[color:var(--kt-text-secondary)]">
          <p className="kt-kv">p95 Query Latency: {state.metrics[0]?.stageLatencyMsP95 ?? 0} ms</p>
          <p className="kt-kv">Ingestion Throughput: {state.metrics[0]?.chunksPerSecond ?? 0} chunk/sec</p>
          <p className="kt-kv">
            Recent Failures: {state.jobs.filter((job) => job.status === 'failed').length}
          </p>
          <p className="kt-kv">Blocked Egress Attempts: {state.blockedEgressAttempts.length}</p>
        </div>
      </section>

      <section className="kt-panel p-4 lg:col-span-3">
        <h3 className="kt-title-lg">Recent Activity</h3>
        <ul className="mt-3 space-y-2 text-sm text-[color:var(--kt-text-secondary)]">
          {state.activity.length === 0 ? <li className="kt-kv">No activity yet.</li> : null}
          {state.activity.slice(0, 12).map((entry) => (
            <li key={entry} className="kt-kv">
              {entry}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="kt-kv">
      <p className="kt-title-sm">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-[color:var(--kt-text-primary)]">{value}</p>
    </div>
  );
}
