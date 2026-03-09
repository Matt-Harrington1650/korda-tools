import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatIngestTs,
  ingestAckAlert,
  ingestGetHealthSnapshot,
  ingestGetJob,
  ingestJobAction,
  ingestListAlerts,
  ingestListJobs,
  type IngestAlertRecord,
  type IngestFileRecord,
  type IngestJobAction,
  type IngestJobSummary,
  type IngestStageRunRecord,
} from '../../features/sophon/ingest/api';

const ACTIVE_STATUSES = ['queued', 'running', 'paused', 'blocked', 'stuck'];

export function SophonIngestionJobsPage() {
  const queryClient = useQueryClient();
  const jobsQuery = useQuery({
    queryKey: ['sophon', 'ingest', 'jobs'],
    queryFn: ingestListJobs,
  });
  const alertsQuery = useQuery({
    queryKey: ['sophon', 'ingest', 'alerts'],
    queryFn: () => ingestListAlerts(20),
  });
  const healthQuery = useQuery({
    queryKey: ['sophon', 'ingest', 'health'],
    queryFn: ingestGetHealthSnapshot,
  });
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  useEffect(() => {
    const firstJobId = jobsQuery.data?.[0]?.jobId;
    if (!selectedJobId && firstJobId) {
      setSelectedJobId(firstJobId);
    }
    if (selectedJobId && jobsQuery.data && !jobsQuery.data.some((job) => job.jobId === selectedJobId) && firstJobId) {
      setSelectedJobId(firstJobId);
    }
  }, [jobsQuery.data, selectedJobId]);

  const detailQuery = useQuery({
    queryKey: ['sophon', 'ingest', 'job', selectedJobId],
    queryFn: () => ingestGetJob(selectedJobId),
    enabled: selectedJobId.length > 0,
  });

  const actionMutation = useMutation({
    mutationFn: (input: { jobId: string; action: IngestJobAction; fileId?: string }) => ingestJobAction(input),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['sophon', 'ingest'] });
      setSelectedJobId(variables.jobId);
    },
  });
  const ackAlertMutation = useMutation({
    mutationFn: (alertId: string) => ingestAckAlert(alertId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sophon', 'ingest', 'alerts'] });
    },
  });

  const jobs = jobsQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];
  const activeJobs = jobs.filter((job) => ACTIVE_STATUSES.includes(job.status));
  const completedJobs = jobs.filter((job) => job.status === 'completed').length;
  const failedJobs = jobs.filter((job) => ['failed', 'stuck', 'blocked'].includes(job.status)).length;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-4">
        <SummaryCard label="Active Jobs" value={activeJobs.length} tone="accent" />
        <SummaryCard label="Completed" value={completedJobs} tone="default" />
        <SummaryCard label="Needs Attention" value={failedJobs} tone="danger" />
        <SummaryCard
          label="Dependency Health"
          value={healthQuery.data?.overallStatus ?? 'unknown'}
          tone={healthQuery.data?.overallStatus === 'healthy' ? 'success' : 'warn'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="kt-panel p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="kt-title-lg">Ingestion Console</h3>
              <p className="text-xs text-[color:var(--kt-text-muted)]">
                Durable background jobs with health polling, alerts, and stage-scoped controls.
              </p>
            </div>
            <button
              className="kt-btn kt-btn-ghost"
              onClick={() => {
                void Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['sophon', 'ingest', 'jobs'] }),
                  queryClient.invalidateQueries({ queryKey: ['sophon', 'ingest', 'alerts'] }),
                  queryClient.invalidateQueries({ queryKey: ['sophon', 'ingest', 'health'] }),
                  queryClient.invalidateQueries({ queryKey: ['sophon', 'ingest', 'job', selectedJobId] }),
                ]);
              }}
              type="button"
            >
              Refresh
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-2">
              {jobs.length === 0 ? (
                <EmptyPanel text="No queued ingestion jobs yet. Queue one from Sources." />
              ) : (
                jobs.map((job) => (
                  <button
                    key={job.jobId}
                    className={`kt-panel-muted w-full p-3 text-left transition ${selectedJobId === job.jobId ? 'border-blue-400/50 ring-1 ring-blue-400/40' : ''}`}
                    onClick={() => {
                      setSelectedJobId(job.jobId);
                    }}
                    type="button"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-[color:var(--kt-text-primary)]">{job.sourceName}</h4>
                        <p className="text-xs text-[color:var(--kt-text-muted)]">
                          {job.jobId} - {job.collectionName}
                        </p>
                      </div>
                      <span className={badgeClass(job.status)}>{job.status}</span>
                    </div>
                    <div className="mt-2 h-2 rounded bg-slate-900">
                      <div className="h-2 rounded bg-blue-500 transition-all" style={{ width: `${Math.max(2, job.progressPct)}%` }} />
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-[color:var(--kt-text-secondary)] md:grid-cols-2">
                      <p className="kt-kv">Stage: {job.currentStage}</p>
                      <p className="kt-kv">File: {job.currentFileName ?? 'pending'}</p>
                      <p className="kt-kv">Files: {job.completedFiles}/{job.totalFiles}</p>
                      <p className="kt-kv">Alerts: {job.activeAlerts}</p>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="space-y-3">
              <HealthRail probes={healthQuery.data?.probes ?? []} />
              <AlertCenter
                alerts={alerts}
                onAcknowledge={(alertId) => {
                  ackAlertMutation.mutate(alertId);
                }}
              />
            </div>
          </div>
        </section>

        <section className="kt-panel p-4">
          {detailQuery.data ? (
            <JobDetailPanel
              alerts={detailQuery.data.alerts}
              eventCount={detailQuery.data.events.length}
              files={detailQuery.data.files}
              job={detailQuery.data.job}
              onAction={(action, fileId) => {
                actionMutation.mutate({ jobId: detailQuery.data!.job.jobId, action, fileId });
              }}
              stageRuns={detailQuery.data.stageRuns}
              stageEvents={detailQuery.data.events}
            />
          ) : (
            <EmptyPanel text="Select a job to inspect its live files, alerts, and event timeline." />
          )}
        </section>
      </div>
    </section>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string | number; tone: 'accent' | 'default' | 'danger' | 'success' | 'warn' }) {
  const toneClass =
    tone === 'accent'
      ? 'border-blue-500/40'
      : tone === 'danger'
        ? 'border-rose-500/40'
        : tone === 'success'
          ? 'border-emerald-500/40'
          : tone === 'warn'
            ? 'border-amber-500/40'
            : 'border-white/10';
  return (
    <div className={`kt-panel-muted border ${toneClass} p-4`}>
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--kt-text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--kt-text-primary)]">{value}</p>
    </div>
  );
}

function HealthRail({ probes }: { probes: Array<{ id: string; label: string; status: string; message: string; healthy: boolean }> }) {
  if (probes.length === 0) {
    return <EmptyPanel text="No dependency health snapshot yet." compact />;
  }

  return (
    <div className="space-y-2">
      <h4 className="kt-title-sm">Dependency Health</h4>
      {probes.map((probe) => (
        <div key={probe.id} className="kt-panel-muted p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-[color:var(--kt-text-primary)]">{probe.label}</p>
            <span className={badgeClass(probe.healthy ? 'completed' : 'failed')}>{probe.status}</span>
          </div>
          <p className="mt-1 text-xs text-[color:var(--kt-text-muted)]">{probe.message}</p>
        </div>
      ))}
    </div>
  );
}

function AlertCenter({ alerts, onAcknowledge }: { alerts: IngestAlertRecord[]; onAcknowledge: (alertId: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="kt-title-sm">Alert Center</h4>
        <span className="kt-chip">{alerts.filter((alert) => alert.status === 'open').length} open</span>
      </div>
      {alerts.length === 0 ? (
        <EmptyPanel text="No alerts." compact />
      ) : (
        alerts.map((alert) => (
          <div key={alert.alertId} className="kt-panel-muted p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-[color:var(--kt-text-primary)]">{alert.title}</p>
                <p className="text-xs text-[color:var(--kt-text-muted)]">{alert.message}</p>
              </div>
              <button
                className="kt-btn kt-btn-ghost"
                disabled={alert.status !== 'open'}
                onClick={() => {
                  onAcknowledge(alert.alertId);
                }}
                type="button"
              >
                Ack
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function JobDetailPanel({
  job,
  files,
  stageRuns,
  stageEvents,
  alerts,
  eventCount,
  onAction,
}: {
  job: IngestJobSummary;
  files: IngestFileRecord[];
  stageRuns: IngestStageRunRecord[];
  stageEvents: Array<{ eventId: string; stage?: string | null; message: string; createdAt: number; level: string }>;
  alerts: IngestAlertRecord[];
  eventCount: number;
  onAction: (action: IngestJobAction, fileId?: string) => void;
}) {
  const currentFile = useMemo(
    () => files.find((file) => file.fileId === job.currentFileId) ?? files.find((file) => ['running', 'queued'].includes(file.status)) ?? files[0],
    [files, job.currentFileId],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="kt-title-lg">{job.sourceName}</h3>
          <p className="text-xs text-[color:var(--kt-text-muted)]">{job.jobId}</p>
        </div>
        <span className={badgeClass(job.status)}>{job.status}</span>
      </div>

      <div className="grid gap-2 text-xs text-[color:var(--kt-text-secondary)] md:grid-cols-2">
        <p className="kt-kv">Stage: {job.currentStage}</p>
        <p className="kt-kv">Heartbeat: {formatIngestTs(job.lastHeartbeatAt)}</p>
        <p className="kt-kv">Updated: {formatIngestTs(job.updatedAt)}</p>
        <p className="kt-kv">Retries: {job.retryCount}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton disabled={job.status !== 'running'} label="Pause" onClick={() => onAction('pause')} />
        <ActionButton disabled={!['paused', 'blocked', 'stuck', 'failed', 'cancelled'].includes(job.status)} label="Resume" onClick={() => onAction('resume_job')} />
        <ActionButton disabled={['completed', 'cancelled'].includes(job.status)} label="Cancel" onClick={() => onAction('cancel')} />
        <ActionButton disabled={!currentFile} label="Retry File" onClick={() => onAction('retry_file', currentFile?.fileId)} />
        <ActionButton disabled={!currentFile} label="Skip File" onClick={() => onAction('skip_file', currentFile?.fileId)} />
      </div>

      {job.errorMessage ? (
        <div className="kt-panel-muted border-rose-400/30 p-3 text-xs text-[color:var(--kt-danger)]">{job.errorMessage}</div>
      ) : null}
      {job.detailMessage ? (
        <div className="kt-panel-muted p-3 text-xs text-[color:var(--kt-text-muted)]">{job.detailMessage}</div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="kt-title-sm">Files</h4>
          <span className="kt-chip">{files.length}</span>
        </div>
        {files.length === 0 ? (
          <EmptyPanel text="No file rows for this job yet." compact />
        ) : (
          files.map((file) => (
            <div key={file.fileId} className={`kt-panel-muted p-3 ${currentFile?.fileId === file.fileId ? 'border-blue-400/40 ring-1 ring-blue-400/30' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[color:var(--kt-text-primary)]">{file.displayName}</p>
                  <p className="text-xs text-[color:var(--kt-text-muted)]">{file.sourcePath}</p>
                </div>
                <span className={badgeClass(file.status)}>{file.status}</span>
              </div>
              <div className="mt-2 h-2 rounded bg-slate-900">
                <div className="h-2 rounded bg-blue-500 transition-all" style={{ width: `${Math.max(2, file.progressPct)}%` }} />
              </div>
              <div className="mt-2 grid gap-1 text-xs text-[color:var(--kt-text-secondary)] md:grid-cols-2">
                <p className="kt-kv">Stage: {file.currentStage}</p>
                <p className="kt-kv">Pages: {formatPageRange(file)}</p>
                <p className="kt-kv">Heartbeat: {formatIngestTs(file.lastHeartbeatAt)}</p>
                <p className="kt-kv">Size: {Math.max(0, Math.round(file.sizeBytes / (1024 * 1024)))} MB</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="kt-title-sm">Stage Runs</h4>
            <span className="kt-chip">{stageRuns.length}</span>
          </div>
          <div className="max-h-[14rem] space-y-2 overflow-auto pr-1">
            {stageRuns.length === 0 ? (
              <EmptyPanel text="No persisted stage runs yet." compact />
            ) : (
              stageRuns.slice(0, 16).map((run) => (
                <div key={run.runId} className="kt-panel-muted p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[color:var(--kt-text-primary)]">{run.stage}</p>
                    <span className={badgeClass(run.status)}>{run.status}</span>
                  </div>
                  <div className="mt-1 grid gap-1 text-xs text-[color:var(--kt-text-muted)] md:grid-cols-2">
                    <p className="kt-kv">Started: {formatIngestTs(run.startedAt)}</p>
                    <p className="kt-kv">Heartbeat: {formatIngestTs(run.heartbeatAt)}</p>
                    <p className="kt-kv">Updated: {formatIngestTs(run.updatedAt)}</p>
                    <p className="kt-kv">Progress: {Math.round(run.progressPct)}%</p>
                  </div>
                  {run.detailMessage ? <p className="mt-2 text-xs text-[color:var(--kt-text-secondary)]">{run.detailMessage}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="kt-title-sm">Recent Events</h4>
            <span className="kt-chip">{eventCount}</span>
          </div>
          <div className="max-h-[22rem] space-y-2 overflow-auto pr-1">
            {stageEvents.slice(0, 24).map((event) => (
              <div key={event.eventId} className="kt-panel-muted p-3">
                <div className="flex items-center justify-between gap-2 text-xs text-[color:var(--kt-text-muted)]">
                  <span>{event.stage ?? 'event'}</span>
                  <span>{formatIngestTs(event.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-[color:var(--kt-text-primary)]">{event.message}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="kt-title-sm">Job Alerts</h4>
            <span className="kt-chip">{alerts.length}</span>
          </div>
          <div className="max-h-[22rem] space-y-2 overflow-auto pr-1">
            {alerts.length === 0 ? (
              <EmptyPanel text="No job-specific alerts." compact />
            ) : (
              alerts.map((alert) => (
                <div key={alert.alertId} className="kt-panel-muted p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[color:var(--kt-text-primary)]">{alert.title}</p>
                    <span className={badgeClass(alert.severity === 'error' ? 'failed' : 'paused')}>{alert.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--kt-text-muted)]">{alert.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="kt-btn kt-btn-secondary" disabled={disabled} onClick={onClick} type="button">
      {label}
    </button>
  );
}

function EmptyPanel({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div
      className={`kt-panel-muted border-dashed px-3 text-sm text-[color:var(--kt-text-muted)] ${compact ? 'py-3' : 'py-5'}`}
    >
      {text}
    </div>
  );
}

function formatPageRange(file: IngestFileRecord): string {
  if (file.pageRangeStart && file.pageRangeEnd) {
    return `${file.pageRangeStart}-${file.pageRangeEnd}`;
  }
  if (file.pageCount) {
    return `1-${file.pageCount}`;
  }
  return 'n/a';
}

const badgeClass = (status: string): string => {
  if (status === 'completed') return 'kt-status kt-status-pass';
  if (status === 'failed' || status === 'stuck' || status === 'blocked' || status === 'error') return 'kt-status kt-status-fail';
  if (status === 'running' || status === 'healthy') return 'kt-status kt-status-info';
  if (status === 'paused' || status === 'degraded' || status === 'warn') return 'kt-status kt-status-warn';
  return 'kt-status';
};
