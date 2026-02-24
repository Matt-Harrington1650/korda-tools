import { useEffect, useMemo, useState } from 'react';
import type { Workflow } from '../domain/workflow';
import { useWorkflowRunner } from '../features/workflows/runner';
import { useScheduleStore, useScheduledRunLogStore, useWorkflowRunStore, useWorkflowStore } from '../features/workflows/store';
import { useToolRegistryStore } from '../features/tools/store/toolRegistryStore';
import { createWorkflowStepId } from '../lib/ids';

const cloneWorkflow = (workflow: Workflow): Workflow => {
  if (typeof structuredClone === 'function') {
    return structuredClone(workflow);
  }

  return JSON.parse(JSON.stringify(workflow)) as Workflow;
};

const statusClassName = (status: string): string => {
  if (status === 'succeeded') {
    return 'text-emerald-700';
  }

  if (status === 'failed' || status === 'cancelled') {
    return 'text-rose-700';
  }

  if (status === 'running') {
    return 'text-amber-700';
  }

  return 'text-slate-600';
};

export function WorkflowsPage() {
  const workflows = useWorkflowStore((state) => state.workflows);
  const selectedWorkflowId = useWorkflowStore((state) => state.selectedWorkflowId);
  const setSelectedWorkflowId = useWorkflowStore((state) => state.setSelectedWorkflowId);
  const createWorkflow = useWorkflowStore((state) => state.createWorkflow);
  const updateWorkflow = useWorkflowStore((state) => state.updateWorkflow);
  const deleteWorkflow = useWorkflowStore((state) => state.deleteWorkflow);
  const runs = useWorkflowRunStore((state) => state.runs);
  const nodeRuns = useWorkflowRunStore((state) => state.nodeRuns);
  const schedules = useScheduleStore((state) => state.schedules);
  const createSchedule = useScheduleStore((state) => state.createSchedule);
  const toggleSchedule = useScheduleStore((state) => state.toggleSchedule);
  const deleteSchedule = useScheduleStore((state) => state.deleteSchedule);
  const clearScheduledLogsForSchedule = useScheduledRunLogStore((state) => state.clearLogsForSchedule);
  const scheduledLogs = useScheduledRunLogStore((state) => state.entries);
  const tools = useToolRegistryStore((state) => state.tools);
  const { startWorkflow, cancelWorkflowRun } = useWorkflowRunner();
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? workflows[0];

  const [draft, setDraft] = useState<Workflow | null>(selectedWorkflow ? cloneWorkflow(selectedWorkflow) : null);
  const [tagsText, setTagsText] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [errorText, setErrorText] = useState('');
  const [messageText, setMessageText] = useState('');
  const [scheduleKind, setScheduleKind] = useState<'interval' | 'cron'>('interval');
  const [scheduleIntervalMinutes, setScheduleIntervalMinutes] = useState('5');
  const [scheduleCron, setScheduleCron] = useState('*/5 * * * *');

  useEffect(() => {
    if (!selectedWorkflow) {
      setDraft(null);
      setTagsText('');
      return;
    }

    setDraft(cloneWorkflow(selectedWorkflow));
    setTagsText(selectedWorkflow.tags.join(', '));
  }, [selectedWorkflow]);

  useEffect(() => {
    if (selectedWorkflow && selectedWorkflow.id !== selectedWorkflowId) {
      setSelectedWorkflowId(selectedWorkflow.id);
    }
  }, [selectedWorkflow, selectedWorkflowId, setSelectedWorkflowId]);

  const workflowRuns = useMemo(() => {
    if (!selectedWorkflow) {
      return [];
    }

    return runs
      .filter((run) => run.workflowId === selectedWorkflow.id)
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
  }, [runs, selectedWorkflow]);

  const workflowSchedules = useMemo(() => {
    if (!selectedWorkflow) {
      return [];
    }

    return schedules
      .filter((schedule) => schedule.workflowId === selectedWorkflow.id)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }, [schedules, selectedWorkflow]);

  const workflowScheduledLogs = useMemo(() => {
    if (!selectedWorkflow) {
      return [];
    }

    return scheduledLogs
      .filter((entry) => entry.workflowId === selectedWorkflow.id)
      .sort((left, right) => Date.parse(right.triggeredAt) - Date.parse(left.triggeredAt))
      .slice(0, 30);
  }, [scheduledLogs, selectedWorkflow]);

  useEffect(() => {
    if (!workflowRuns.length) {
      setSelectedRunId('');
      return;
    }

    if (!workflowRuns.some((run) => run.id === selectedRunId)) {
      setSelectedRunId(workflowRuns[0].id);
    }
  }, [selectedRunId, workflowRuns]);

  const selectedRun = workflowRuns.find((run) => run.id === selectedRunId);
  const selectedNodeRuns = useMemo(() => {
    if (!selectedRun) {
      return [];
    }

    return nodeRuns
      .filter((nodeRun) => nodeRun.workflowRunId === selectedRun.id)
      .sort((left, right) => {
        const leftTs = Date.parse(left.startedAt ?? left.finishedAt ?? new Date(0).toISOString());
        const rightTs = Date.parse(right.startedAt ?? right.finishedAt ?? new Date(0).toISOString());
        return leftTs - rightTs;
      });
  }, [nodeRuns, selectedRun]);

  const activeRun = workflowRuns.find((run) => run.status === 'running');

  const createNewWorkflow = (): void => {
    const firstToolId = tools[0]?.id ?? '';
    const workflow = createWorkflow({
      name: `Workflow ${workflows.length + 1}`,
      steps: [
        {
          id: createWorkflowStepId(),
          name: 'Step 1',
          toolId: firstToolId,
          actionType: 'run',
          payload: '',
          continueOnError: false,
        },
      ],
    });

    setSelectedWorkflowId(workflow.id);
    setMessageText('Workflow created.');
    setErrorText('');
  };

  const saveDraft = (): void => {
    if (!selectedWorkflow || !draft) {
      return;
    }

    if (draft.name.trim().length === 0) {
      setErrorText('Workflow name is required.');
      return;
    }

    if (draft.steps.length === 0) {
      setErrorText('Add at least one workflow step.');
      return;
    }

    if (draft.steps.some((step) => step.toolId.trim().length === 0)) {
      setErrorText('Every step must select a tool.');
      return;
    }

    const tags = tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const updated = updateWorkflow(selectedWorkflow.id, {
      ...draft,
      tags,
    });

    if (!updated) {
      setErrorText('Unable to save workflow.');
      return;
    }

    setDraft(cloneWorkflow(updated));
    setTagsText(updated.tags.join(', '));
    setErrorText('');
    setMessageText('Workflow saved.');
  };

  const removeWorkflow = (): void => {
    if (!selectedWorkflow) {
      return;
    }

    const confirmed = window.confirm(`Delete workflow "${selectedWorkflow.name}"?`);
    if (!confirmed) {
      return;
    }

    deleteWorkflow(selectedWorkflow.id);
    schedules
      .filter((schedule) => schedule.workflowId === selectedWorkflow.id)
      .forEach((schedule) => {
        deleteSchedule(schedule.id);
        clearScheduledLogsForSchedule(schedule.id);
      });
    setMessageText('Workflow deleted.');
    setErrorText('');
  };

  const runWorkflow = (): void => {
    if (!selectedWorkflow || activeRun) {
      return;
    }

    const runId = startWorkflow(selectedWorkflow);
    setSelectedRunId(runId);
    setMessageText('Workflow run started.');
    setErrorText('');
  };

  const cancelRun = (): void => {
    if (!activeRun) {
      return;
    }

    cancelWorkflowRun(activeRun.id);
  };

  const addSchedule = (): void => {
    if (!selectedWorkflow) {
      return;
    }

    if (scheduleKind === 'interval') {
      const minutes = Number(scheduleIntervalMinutes);
      if (!Number.isFinite(minutes) || minutes < 1) {
        setErrorText('Interval minutes must be at least 1.');
        return;
      }

      createSchedule({
        workflowId: selectedWorkflow.id,
        name: `${selectedWorkflow.name} every ${minutes}m`,
        kind: 'interval',
        intervalMs: Math.trunc(minutes * 60_000),
      });
      setMessageText('Interval schedule added.');
      setErrorText('');
      return;
    }

    if (scheduleCron.trim().split(/\s+/).length !== 5) {
      setErrorText('Cron expression must have 5 fields.');
      return;
    }

    createSchedule({
      workflowId: selectedWorkflow.id,
      name: `${selectedWorkflow.name} cron`,
      kind: 'cron',
      cron: scheduleCron.trim(),
    });
    setMessageText('Cron schedule added.');
    setErrorText('');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Workflows</h2>
          <button
            className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800"
            onClick={createNewWorkflow}
            type="button"
          >
            New
          </button>
        </div>

        {workflows.length === 0 ? (
          <p className="text-sm text-slate-500">No workflows yet.</p>
        ) : (
          <ul className="space-y-2">
            {workflows.map((workflow) => (
              <li key={workflow.id}>
                <button
                  className={`w-full rounded border px-3 py-2 text-left text-sm ${
                    selectedWorkflow?.id === workflow.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    setSelectedWorkflowId(workflow.id);
                    setMessageText('');
                    setErrorText('');
                  }}
                  type="button"
                >
                  <p className="font-medium">{workflow.name}</p>
                  <p className="text-xs opacity-80">{workflow.steps.length} step(s)</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Workflow Builder</h2>
            <div className="flex items-center gap-2">
              <button
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                disabled={!selectedWorkflow}
                onClick={removeWorkflow}
                type="button"
              >
                Delete
              </button>
              <button
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                disabled={!selectedWorkflow || !draft}
                onClick={saveDraft}
                type="button"
              >
                Save Workflow
              </button>
            </div>
          </div>

          {!draft ? (
            <p className="text-sm text-slate-500">Select or create a workflow.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Name</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    onChange={(event) => {
                      setDraft((current) => (current ? { ...current, name: event.target.value } : current));
                    }}
                    value={draft.name}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Tags</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    onChange={(event) => {
                      setTagsText(event.target.value);
                    }}
                    placeholder="integration, nightly"
                    value={tagsText}
                  />
                </label>
              </div>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Description</span>
                <textarea
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => {
                    setDraft((current) => (current ? { ...current, description: event.target.value } : current));
                  }}
                  rows={2}
                  value={draft.description}
                />
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Steps (linear)</h3>
                  <button
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setDraft((current) => {
                        if (!current) {
                          return current;
                        }

                        return {
                          ...current,
                          steps: [
                            ...current.steps,
                            {
                              id: createWorkflowStepId(),
                              name: `Step ${current.steps.length + 1}`,
                              toolId: tools[0]?.id ?? '',
                              actionType: 'run',
                              payload: '',
                              continueOnError: false,
                            },
                          ],
                        };
                      });
                    }}
                    type="button"
                  >
                    Add Step
                  </button>
                </div>

                {draft.steps.map((step, index) => (
                  <div className="space-y-2 rounded border border-slate-200 p-3" key={step.id}>
                    <div className="grid gap-2 md:grid-cols-[1.3fr_1fr_1fr_auto]">
                      <input
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                        onChange={(event) => {
                          setDraft((current) => {
                            if (!current) {
                              return current;
                            }

                            const steps = [...current.steps];
                            steps[index] = {
                              ...steps[index],
                              name: event.target.value,
                            };
                            return {
                              ...current,
                              steps,
                            };
                          });
                        }}
                        placeholder="Step name"
                        value={step.name}
                      />
                      <select
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                        onChange={(event) => {
                          setDraft((current) => {
                            if (!current) {
                              return current;
                            }

                            const steps = [...current.steps];
                            steps[index] = {
                              ...steps[index],
                              toolId: event.target.value,
                            };
                            return {
                              ...current,
                              steps,
                            };
                          });
                        }}
                        value={step.toolId}
                      >
                        <option value="">Select tool</option>
                        {tools.map((tool) => (
                          <option key={tool.id} value={tool.id}>
                            {tool.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                        onChange={(event) => {
                          setDraft((current) => {
                            if (!current) {
                              return current;
                            }

                            const steps = [...current.steps];
                            steps[index] = {
                              ...steps[index],
                              actionType: event.target.value === 'test' ? 'test' : 'run',
                            };
                            return {
                              ...current,
                              steps,
                            };
                          });
                        }}
                        value={step.actionType}
                      >
                        <option value="run">Run</option>
                        <option value="test">Test</option>
                      </select>
                      <button
                        className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                        onClick={() => {
                          setDraft((current) => {
                            if (!current) {
                              return current;
                            }

                            return {
                              ...current,
                              steps: current.steps.filter((item) => item.id !== step.id),
                            };
                          });
                        }}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        checked={step.continueOnError}
                        onChange={(event) => {
                          setDraft((current) => {
                            if (!current) {
                              return current;
                            }

                            const steps = [...current.steps];
                            steps[index] = {
                              ...steps[index],
                              continueOnError: event.target.checked,
                            };
                            return {
                              ...current,
                              steps,
                            };
                          });
                        }}
                        type="checkbox"
                      />
                      Continue on error
                    </label>
                    <textarea
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      onChange={(event) => {
                        setDraft((current) => {
                          if (!current) {
                            return current;
                          }

                          const steps = [...current.steps];
                          steps[index] = {
                            ...steps[index],
                            payload: event.target.value,
                          };
                          return {
                            ...current,
                            steps,
                          };
                        });
                      }}
                      placeholder="Optional step payload"
                      rows={3}
                      value={step.payload}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {errorText ? <p className="mt-3 text-sm text-rose-700">{errorText}</p> : null}
          {messageText ? <p className="mt-3 text-sm text-emerald-700">{messageText}</p> : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Schedules (desktop only)</h3>
          </div>

          {!selectedWorkflow ? (
            <p className="text-sm text-slate-500">Select a workflow to configure schedules.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 md:grid-cols-[140px_1fr_auto]">
                <select
                  className="rounded border border-slate-300 px-2 py-2 text-sm"
                  onChange={(event) => {
                    setScheduleKind(event.target.value === 'cron' ? 'cron' : 'interval');
                  }}
                  value={scheduleKind}
                >
                  <option value="interval">Interval</option>
                  <option value="cron">Cron</option>
                </select>
                {scheduleKind === 'interval' ? (
                  <input
                    className="rounded border border-slate-300 px-2 py-2 text-sm"
                    onChange={(event) => {
                      setScheduleIntervalMinutes(event.target.value);
                    }}
                    placeholder="Minutes"
                    type="number"
                    value={scheduleIntervalMinutes}
                  />
                ) : (
                  <input
                    className="rounded border border-slate-300 px-2 py-2 text-sm"
                    onChange={(event) => {
                      setScheduleCron(event.target.value);
                    }}
                    placeholder="*/5 * * * *"
                    value={scheduleCron}
                  />
                )}
                <button
                  className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={addSchedule}
                  type="button"
                >
                  Add Schedule
                </button>
              </div>

              {workflowSchedules.length === 0 ? (
                <p className="text-sm text-slate-500">No schedules configured.</p>
              ) : (
                <ul className="space-y-2">
                  {workflowSchedules.map((schedule) => (
                    <li className="rounded border border-slate-200 p-3" key={schedule.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{schedule.name}</p>
                          <p className="text-xs text-slate-600">
                            {schedule.kind === 'interval'
                              ? `every ${Math.round((schedule.intervalMs ?? 60_000) / 60_000)}m`
                              : schedule.cron}
                          </p>
                          <p className="text-xs text-slate-500">
                            Next run: {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : 'pending'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs text-slate-700">
                            <input
                              checked={schedule.enabled}
                              onChange={(event) => {
                                toggleSchedule(schedule.id, event.target.checked);
                              }}
                              type="checkbox"
                            />
                            Enabled
                          </label>
                          <button
                            className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                            onClick={() => {
                              deleteSchedule(schedule.id);
                              clearScheduledLogsForSchedule(schedule.id);
                            }}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div>
                <h4 className="text-sm font-semibold text-slate-900">Scheduled Run Logs</h4>
                {workflowScheduledLogs.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">No scheduled runs yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {workflowScheduledLogs.map((entry) => (
                      <li className="rounded border border-slate-200 px-2 py-2 text-xs" key={entry.id}>
                        <p className={`font-medium ${statusClassName(entry.status)}`}>{entry.status}</p>
                        <p className="text-slate-600">{new Date(entry.triggeredAt).toLocaleString()}</p>
                        <p className="text-slate-700">{entry.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Run Workflow</h3>
            <div className="flex items-center gap-2">
              <button
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-70"
                disabled={!selectedWorkflow || !!activeRun}
                onClick={runWorkflow}
                type="button"
              >
                Run
              </button>
              <button
                className="rounded border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-70"
                disabled={!activeRun}
                onClick={cancelRun}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>

          {workflowRuns.length === 0 ? (
            <p className="text-sm text-slate-500">No workflow runs yet.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-[220px_1fr]">
              <ul className="space-y-2">
                {workflowRuns.map((run) => (
                  <li key={run.id}>
                    <button
                      className={`w-full rounded border px-2 py-2 text-left text-xs ${
                        run.id === selectedRunId
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                      onClick={() => {
                        setSelectedRunId(run.id);
                      }}
                      type="button"
                    >
                      <p className={`font-semibold ${run.id === selectedRunId ? 'text-white' : statusClassName(run.status)}`}>{run.status}</p>
                      <p>{new Date(run.startedAt).toLocaleString()}</p>
                      <p>{run.durationMs} ms</p>
                    </button>
                  </li>
                ))}
              </ul>

              <div>
                {!selectedRun ? (
                  <p className="text-sm text-slate-500">Select a run to inspect outputs.</p>
                ) : (
                  <div className="space-y-2">
                    <p className={`text-sm font-medium ${statusClassName(selectedRun.status)}`}>
                      Run status: {selectedRun.status}
                    </p>
                    {selectedRun.errorMessage ? <p className="text-xs text-rose-700">{selectedRun.errorMessage}</p> : null}
                    <ul className="space-y-2">
                      {selectedNodeRuns.map((nodeRun) => (
                        <li className="rounded border border-slate-200 p-3" key={nodeRun.id}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900">{nodeRun.stepName}</p>
                            <p className={`text-xs font-medium ${statusClassName(nodeRun.status)}`}>{nodeRun.status}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">Tool: {nodeRun.toolId}</p>
                          <p className="mt-1 text-xs text-slate-600">Request: {nodeRun.requestSummary || 'n/a'}</p>
                          <p className="mt-1 text-xs text-slate-600">Response: {nodeRun.responseSummary || 'n/a'}</p>
                          {nodeRun.output ? (
                            <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-950 p-2 text-xs text-emerald-200">
                              {nodeRun.output}
                            </pre>
                          ) : null}
                          {nodeRun.errorMessage ? (
                            <p className="mt-2 text-xs text-rose-700">{nodeRun.errorMessage}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
