import { create } from 'zustand';
import type { ScheduledRunLog, ScheduledRunStatus, ScheduleKind } from '../../../domain/schedule';
import { createScheduledRunLogId } from '../../../lib/ids';
import {
  scheduledRunLogHistorySchema,
  scheduledRunLogSchema,
  scheduledRunLogSchemaVersion,
} from '../../../schemas/scheduleSchemas';
import { createStorageEngine, hasAsyncLoad } from '../../../storage/createStorageEngine';
import { STORAGE_KEYS } from '../../../storage/keys';
import { migrateScheduledRunLogs } from '../../../storage/migrations';

const MAX_SCHEDULED_LOGS = 1000;

const persistence = createStorageEngine({
  key: STORAGE_KEYS.scheduledRunLogs,
  schema: scheduledRunLogHistorySchema,
  defaultValue: {
    version: scheduledRunLogSchemaVersion,
    entries: [],
  },
  migrate: migrateScheduledRunLogs,
});

const persistEntries = (entries: ScheduledRunLog[]): void => {
  persistence.save({
    version: scheduledRunLogSchemaVersion,
    entries: entries.slice(0, MAX_SCHEDULED_LOGS),
  });
};

type AppendScheduledRunLogInput = {
  scheduleId: string;
  workflowId: string;
  workflowRunId: string | null;
  kind: ScheduleKind;
  status: ScheduledRunStatus;
  message: string;
  triggeredAt?: string;
};

type ScheduledRunLogState = {
  entries: ScheduledRunLog[];
  appendScheduledRunLog: (input: AppendScheduledRunLogInput) => ScheduledRunLog;
  getLogsByWorkflowId: (workflowId: string) => ScheduledRunLog[];
  clearLogsForSchedule: (scheduleId: string) => void;
};

export const useScheduledRunLogStore = create<ScheduledRunLogState>((set, get) => ({
  entries: persistence.load().entries,
  appendScheduledRunLog: (input) => {
    const entry = scheduledRunLogSchema.parse({
      id: createScheduledRunLogId(),
      version: scheduledRunLogSchemaVersion,
      scheduleId: input.scheduleId,
      workflowId: input.workflowId,
      workflowRunId: input.workflowRunId,
      kind: input.kind,
      triggeredAt: input.triggeredAt ?? new Date().toISOString(),
      status: input.status,
      message: input.message,
    });

    const nextEntries = [entry, ...get().entries].slice(0, MAX_SCHEDULED_LOGS);
    persistEntries(nextEntries);
    set({ entries: nextEntries });
    return entry;
  },
  getLogsByWorkflowId: (workflowId) => {
    return get().entries
      .filter((entry) => entry.workflowId === workflowId)
      .sort((left, right) => Date.parse(right.triggeredAt) - Date.parse(left.triggeredAt));
  },
  clearLogsForSchedule: (scheduleId) => {
    const nextEntries = get().entries.filter((entry) => entry.scheduleId !== scheduleId);
    persistEntries(nextEntries);
    set({ entries: nextEntries });
  },
}));

if (hasAsyncLoad(persistence)) {
  void persistence
    .loadAsync()
    .then((persisted) => {
      useScheduledRunLogStore.setState({
        entries: persisted.entries,
      });
    })
    .catch(() => {
      // TODO(extension): add telemetry hook for async scheduled run log hydration failures.
    });
}
