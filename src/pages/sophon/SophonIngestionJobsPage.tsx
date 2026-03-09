import { useSophonStore } from '../../features/sophon/store/sophonStore';

export function SophonIngestionJobsPage() {
  const jobs = useSophonStore((store) => store.state.jobs);
  const pauseJob = useSophonStore((store) => store.pauseJob);
  const resumeJob = useSophonStore((store) => store.resumeJob);
  const cancelJob = useSophonStore((store) => store.cancelJob);
  const retryJob = useSophonStore((store) => store.retryJob);

  return (
    <section className="kt-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="kt-title-lg">Ingestion Jobs</h3>
        <p className="text-xs text-[color:var(--kt-text-muted)]">Pause, resume, cancel, retry, and inspect per-stage checkpoints.</p>
      </div>
      <div className="space-y-3">
        {jobs.length === 0 ? (
          <p className="kt-panel-muted border-dashed px-3 py-3 text-sm text-[color:var(--kt-text-muted)]">
            No jobs yet. Queue ingestion from Sources.
          </p>
        ) : null}

        {jobs.map((job) => (
          <article key={job.id} className="kt-panel-muted p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-[color:var(--kt-text-primary)]">{job.sourceName}</h4>
                <p className="text-xs text-[color:var(--kt-text-muted)]">Job ID: {job.id}</p>
              </div>
              <span className={badgeClass(job.status)}>{job.status}</span>
            </div>

            <div className="mt-2 grid gap-2 text-xs text-[color:var(--kt-text-secondary)] md:grid-cols-4">
              <p className="kt-kv">Current stage: {job.currentStage}</p>
              <p className="kt-kv">Processed: {job.processedDocuments}</p>
              <p className="kt-kv">Chunks: {job.producedChunks}</p>
              <p className="kt-kv">Retries: {job.retries}</p>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="kt-btn kt-btn-secondary"
                disabled={job.status !== 'running'}
                onClick={() => {
                  pauseJob(job.id);
                }}
                type="button"
              >
                Pause
              </button>
              <button
                className="kt-btn kt-btn-secondary"
                disabled={job.status !== 'paused'}
                onClick={() => {
                  resumeJob(job.id);
                }}
                type="button"
              >
                Resume
              </button>
              <button
                className="kt-btn kt-btn-ghost"
                disabled={['completed', 'failed', 'cancelled'].includes(job.status)}
                onClick={() => {
                  cancelJob(job.id);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="kt-btn kt-btn-ghost"
                disabled={job.status !== 'failed' && job.status !== 'cancelled'}
                onClick={() => {
                  retryJob(job.id);
                }}
                type="button"
              >
                Retry
              </button>
            </div>
            <p className="mt-2 text-xs text-[color:var(--kt-text-muted)]">
              Actions available: Pause (running), Resume (paused), Cancel (active), Retry (failed/cancelled).
            </p>

            {job.failureReason ? (
              <p className="kt-panel-muted mt-2 border-rose-400/40 px-2 py-1 text-xs text-[color:var(--kt-danger)]">
                Failure: {job.failureReason}
              </p>
            ) : null}
            {job.validation.errors.length > 0 ? (
              <p className="kt-panel-muted mt-2 border-rose-400/40 px-2 py-1 text-xs text-[color:var(--kt-danger)]">
                Validation Errors: {job.validation.errors.join(' | ')}
              </p>
            ) : null}

            <div className="mt-3 space-y-1">
              {job.stages.map((stage) => (
                <div key={`${job.id}-${stage.stage}`} className="kt-panel-muted p-2">
                  <div className="mb-1 flex items-center justify-between text-xs text-[color:var(--kt-text-secondary)]">
                    <span className="font-medium capitalize text-[color:var(--kt-text-primary)]">{stage.stage}</span>
                    <span>{stage.status}</span>
                  </div>
                  <div className="h-2 rounded bg-slate-800">
                    <div
                      className="h-2 rounded bg-blue-500 transition-all"
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
  if (status === 'completed') return 'kt-status kt-status-pass';
  if (status === 'failed') return 'kt-status kt-status-fail';
  if (status === 'running') return 'kt-status kt-status-info';
  if (status === 'paused') return 'kt-status kt-status-warn';
  if (status === 'cancelled') return 'kt-status';
  return 'kt-status';
};
