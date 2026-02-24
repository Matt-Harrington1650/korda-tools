import { createNotificationService } from '../../../desktop';
import { isTauriRuntime } from '../../../lib/runtime';
import { useSettingsStore } from '../../settings/store';
import { useToolRegistryStore } from '../../tools/store/toolRegistryStore';
import { startLinearWorkflowRun } from '../runner/workflowRunner';
import { useScheduleStore } from '../store/scheduleStore';
import { useScheduledRunLogStore } from '../store/scheduledRunLogStore';
import { useWorkflowRunStore } from '../store/workflowRunStore';
import { useWorkflowStore } from '../store/workflowStore';
import { findNextCronAt, cronMatchesDate } from './cron';

const SCHEDULER_TICK_MS = 15_000;
const RUNNING_SCHEDULES = new Set<string>();

let started = false;
let timerId: number | null = null;
let isTicking = false;

const notificationService = createNotificationService();

const nowIso = (): string => new Date().toISOString();

const resolveNextRunAt = (schedule: {
  kind: 'interval' | 'cron';
  intervalMs: number | null;
  cron: string | null;
  lastRunAt: string | null;
  updatedAt: string;
}): string | null => {
  if (schedule.kind === 'interval') {
    if (!schedule.intervalMs) {
      return null;
    }

    const base = schedule.lastRunAt ?? schedule.updatedAt;
    return new Date(Date.parse(base) + schedule.intervalMs).toISOString();
  }

  if (!schedule.cron) {
    return null;
  }

  return findNextCronAt(schedule.cron, schedule.lastRunAt ?? schedule.updatedAt);
};

const isScheduleDue = (schedule: {
  kind: 'interval' | 'cron';
  intervalMs: number | null;
  cron: string | null;
  lastRunAt: string | null;
  updatedAt: string;
}): boolean => {
  const now = new Date();

  if (schedule.kind === 'interval') {
    if (!schedule.intervalMs) {
      return false;
    }

    const base = schedule.lastRunAt ?? schedule.updatedAt;
    return Date.now() - Date.parse(base) >= schedule.intervalMs;
  }

  if (!schedule.cron) {
    return false;
  }

  const minuteSlot = new Date(now);
  minuteSlot.setSeconds(0, 0);
  const lastRunAt = schedule.lastRunAt ? Date.parse(schedule.lastRunAt) : 0;
  if (lastRunAt >= minuteSlot.getTime()) {
    return false;
  }

  return cronMatchesDate(schedule.cron, minuteSlot);
};

const notifyRunResult = async (message: string, status: 'succeeded' | 'failed' | 'cancelled'): Promise<void> => {
  const schedulerSettings = useSettingsStore.getState().settings.scheduler;
  if (!schedulerSettings.notificationsEnabled) {
    return;
  }

  if (status === 'succeeded' && !schedulerSettings.notifyOnSuccess) {
    return;
  }

  if ((status === 'failed' || status === 'cancelled') && !schedulerSettings.notifyOnFailure) {
    return;
  }

  const title = status === 'succeeded' ? 'Scheduled Workflow Succeeded' : 'Scheduled Workflow Failed';
  await notificationService.notify(title, message);
};

const runSchedule = async (scheduleId: string): Promise<void> => {
  if (RUNNING_SCHEDULES.has(scheduleId)) {
    return;
  }

  const scheduleStore = useScheduleStore.getState();
  const schedule = scheduleStore.schedules.find((item) => item.id === scheduleId);
  if (!schedule || !schedule.enabled) {
    return;
  }

  const workflow = useWorkflowStore.getState().getWorkflowById(schedule.workflowId);
  if (!workflow) {
    useScheduledRunLogStore.getState().appendScheduledRunLog({
      scheduleId: schedule.id,
      workflowId: schedule.workflowId,
      workflowRunId: null,
      kind: schedule.kind,
      status: 'failed',
      message: 'Workflow not found for schedule.',
    });
    return;
  }

  RUNNING_SCHEDULES.add(schedule.id);
  const startedAt = nowIso();

  try {
    useScheduleStore.getState().updateSchedule(schedule.id, {
      lastRunAt: startedAt,
      nextRunAt: resolveNextRunAt({
        ...schedule,
        lastRunAt: startedAt,
      }),
    });

    const startedRun = startLinearWorkflowRun({
      workflow,
      defaultTimeoutMs: useSettingsStore.getState().settings.defaultTimeoutMs,
      resolveTool: (toolId) => {
        return useToolRegistryStore.getState().getToolById(toolId);
      },
      callbacks: {
        onRunUpsert: useWorkflowRunStore.getState().upsertRun,
        onNodeRunUpsert: useWorkflowRunStore.getState().upsertNodeRun,
      },
    });

    const completed = await startedRun.completion;

    const mappedStatus =
      completed.status === 'succeeded'
        ? 'succeeded'
        : completed.status === 'cancelled'
          ? 'cancelled'
          : 'failed';
    const message =
      mappedStatus === 'succeeded'
        ? `${workflow.name} completed successfully.`
        : `${workflow.name} ended with status ${completed.status}. ${completed.errorMessage}`;

    useScheduledRunLogStore.getState().appendScheduledRunLog({
      scheduleId: schedule.id,
      workflowId: workflow.id,
      workflowRunId: completed.id,
      kind: schedule.kind,
      status: mappedStatus,
      message,
      triggeredAt: startedAt,
    });

    await notifyRunResult(message, mappedStatus);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    useScheduledRunLogStore.getState().appendScheduledRunLog({
      scheduleId: schedule.id,
      workflowId: workflow.id,
      workflowRunId: null,
      kind: schedule.kind,
      status: 'failed',
      message,
      triggeredAt: startedAt,
    });
    await notifyRunResult(`${workflow.name} scheduler error: ${message}`, 'failed');
  } finally {
    RUNNING_SCHEDULES.delete(schedule.id);
  }
};

const tickScheduler = async (): Promise<void> => {
  if (isTicking) {
    return;
  }

  if (!isTauriRuntime()) {
    return;
  }

  const schedulerSettings = useSettingsStore.getState().settings.scheduler;
  if (!schedulerSettings.enabled) {
    return;
  }

  isTicking = true;
  try {
    const schedules = useScheduleStore.getState().schedules.filter((schedule) => schedule.enabled);
    for (const schedule of schedules) {
      const nextRunAt = resolveNextRunAt(schedule);
      if (schedule.nextRunAt !== nextRunAt) {
        useScheduleStore.getState().updateSchedule(schedule.id, {
          nextRunAt,
        });
      }

      if (isScheduleDue(schedule)) {
        await runSchedule(schedule.id);
      }
    }
  } finally {
    isTicking = false;
  }
};

export const startDesktopScheduler = (): void => {
  if (!isTauriRuntime() || started) {
    return;
  }

  started = true;
  void tickScheduler();
  timerId = window.setInterval(() => {
    void tickScheduler();
  }, SCHEDULER_TICK_MS);
};

export const stopDesktopScheduler = (): void => {
  if (timerId !== null) {
    window.clearInterval(timerId);
  }

  timerId = null;
  started = false;
  isTicking = false;
  RUNNING_SCHEDULES.clear();
};
