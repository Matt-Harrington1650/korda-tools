import { useSophonStore } from '../../features/sophon/store/sophonStore';

export function SophonIngestionJobsPage() {
  const jobs = useSophonStore((store) => store.state.jobs);
  const pauseJob = useSophonStore((store) => store.pauseJob);
  const resumeJob = useSophonStore((store) => store.resumeJob);
  const cancelJob = useSophonStore((store) => store.cancelJob);
  const retryJob = useSophonStore((store) => store.retryJob);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Ingestion Jobs</h3>
        <p className="text-xs text-slate-500">Pause, resume, cancel, retry, and inspect per-stage checkpoints.</p>
      </div>
      <div className="space-y-3">
        {jobs.length === 0 ? (
          <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            No jobs yet. Queue ingestion from Sources.
          </p>
        ) : null}

        {jobs.map((job) => (
          <article key={job.id} className="rounded border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-medium text-slate-900">{job.sourceName}</h4>
                <p className="text-xs text-slate-600">Job ID: {job.id}</p>
              </div>
              <span className={badgeClass(job.status)}>{job.status}</span>
            </div>

            <div className="mt-2 grid gap-2 text-xs text-slate-700 md:grid-cols-4">
              <p className="rounded bg-slate-50 px-2 py-1">Current stage: {job.currentStage}</p>
              <p className="rounded bg-slate-50 px-2 py-1">Processed: {job.processedDocuments}</p>
              <p className="rounded bg-slate-50 px-2 py-1">Chunks: {job.producedChunks}</p>
              <p className="rounded bg-slate-50 px-2 py-1">Retries: {job.retries}</p>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="rounded border border-blue-300 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={job.status !== 'running'}
                onClick={() => {
                  pauseJob(job.id);
                }}
                type="button"
              >
                Pause
              </button>
              <button
                className="rounded border border-blue-300 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={job.status !== 'paused'}
                onClick={() => {
                  resumeJob(job.id);
                }}
                type="button"
              >
                Resume
              </button>
              <button
                className="rounded border border-amber-300 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={['completed', 'failed', 'cancelled'].includes(job.status)}
                onClick={() => {
                  cancelJob(job.id);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={job.status !== 'failed' && job.status !== 'cancelled'}
                onClick={() => {
                  retryJob(job.id);
                }}
                type="button"
              >
                Retry
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Actions available: Pause (running), Resume (paused), Cancel (active), Retry (failed/cancelled).
            </p>

            {job.failureReason ? (
              <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                Failure: {job.failureReason}
              </p>
            ) : null}
            {job.validation.errors.length > 0 ? (
              <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                Validation Errors: {job.validation.errors.join(' | ')}
              </p>
            ) : null}

            <div className="mt-3 space-y-1">
              {job.stages.map((stage) => (
                <div key={`${job.id}-${stage.stage}`} className="rounded border border-slate-200 p-2">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium capitalize text-slate-800">{stage.stage}</span>
                    <span className="text-slate-600">{stage.status}</span>
                  </div>
                  <div className="h-2 rounded bg-slate-100">
                    <div
                      className="h-2 rounded bg-blue-600 transition-all"
                      style={{ width: `${Math.max(2, stage.progressPct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const badgeClass = (status: string): string => {
  const base = 'rounded px-2 py-1 text-xs font-medium';
  if (status === 'completed') return `${base} bg-emerald-100 text-emerald-700`;
  if (status === 'failed') return `${base} bg-rose-100 text-rose-700`;
  if (status === 'running') return `${base} bg-blue-100 text-blue-700`;
  if (status === 'paused') return `${base} bg-amber-100 text-amber-700`;
  if (status === 'cancelled') return `${base} bg-slate-200 text-slate-700`;
  return `${base} bg-slate-100 text-slate-700`;
};
