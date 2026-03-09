import { useSophonStore } from '../../features/sophon/store/sophonStore';

export function SophonDashboardPage() {
  const state = useSophonStore((store) => store.state);
  const startRuntime = useSophonStore((store) => store.startRuntime);
  const stopRuntime = useSophonStore((store) => store.stopRuntime);
  const runHealthCheck = useSophonStore((store) => store.runHealthCheck);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">System Health</h3>
          <div className="flex gap-2">
            <button
              className="rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
              onClick={() => {
                runHealthCheck();
              }}
              type="button"
            >
              Refresh
            </button>
            <button
              className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600"
              onClick={() => {
                startRuntime();
              }}
              type="button"
            >
              Start
            </button>
            <button
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Latency + Throughput (Local)</h3>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p className="rounded border border-blue-100 bg-blue-50 px-3 py-2">p95 Query Latency: {state.metrics[0]?.stageLatencyMsP95 ?? 0} ms</p>
          <p className="rounded border border-blue-100 bg-blue-50 px-3 py-2">Ingestion Throughput: {state.metrics[0]?.chunksPerSecond ?? 0} chunk/sec</p>
          <p className="rounded border border-blue-100 bg-blue-50 px-3 py-2">
            Recent Failures: {state.jobs.filter((job) => job.status === 'failed').length}
          </p>
          <p className="rounded border border-blue-100 bg-blue-50 px-3 py-2">Blocked Egress Attempts: {state.blockedEgressAttempts.length}</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-3">
        <h3 className="text-base font-semibold text-slate-900">Recent Activity</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {state.activity.length === 0 ? <li>No activity yet.</li> : null}
          {state.activity.slice(0, 12).map((entry) => (
            <li key={entry} className="rounded border border-slate-100 bg-slate-50 px-3 py-2">
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
    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-slate-900">{value}</p>
    </div>
  );
}
