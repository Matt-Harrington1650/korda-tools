import { create } from 'zustand';
import type { Schedule, ScheduleKind } from '../../../domain/schedule';
import { createScheduleId } from '../../../lib/ids';
import { scheduleRegistrySchema, scheduleSchema, scheduleSchemaVersion } from '../../../schemas/scheduleSchemas';
import { createStorageEngine, hasAsyncLoad } from '../../../storage/createStorageEngine';
import { STORAGE_KEYS } from '../../../storage/keys';
import { migrateSchedules } from '../../../storage/migrations';

const persistence = createStorageEngine({
  key: STORAGE_KEYS.schedules,
  schema: scheduleRegistrySchema,
  defaultValue: {
    version: scheduleSchemaVersion,
    schedules: [],
  },
  migrate: migrateSchedules,
});

const persistSchedules = (schedules: Schedule[]): void => {
  persistence.save({
    version: scheduleSchemaVersion,
    schedules,
  });
};

const nextIntervalAt = (baseIso: string, intervalMs: number): string => {
  return new Date(Date.parse(baseIso) + intervalMs).toISOString();
};

type CreateScheduleInput = {
  workflowId: string;
  name: string;
  kind: ScheduleKind;
  intervalMs?: number | null;
  cron?: string | null;
  enabled?: boolean;
};

type UpdateScheduleInput = Partial<Omit<Schedule, 'id' | 'version' | 'workflowId' | 'createdAt'>>;

type ScheduleState = {
  schedules: Schedule[];
  createSchedule: (input: CreateScheduleInput) => Schedule;
  updateSchedule: (scheduleId: string, input: UpdateScheduleInput) => Schedule | null;
  deleteSchedule: (scheduleId: string) => void;
  toggleSchedule: (scheduleId: string, enabled: boolean) => Schedule | null;
  getSchedulesByWorkflowId: (workflowId: string) => Schedule[];
};

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: persistence.load().schedules,
  createSchedule: (input) => {
    const now = new Date().toISOString();
    const intervalMs = input.kind === 'interval' ? Math.max(60_000, Math.trunc(input.intervalMs ?? 300_000)) : null;
    const schedule = scheduleSchema.parse({
      id: createScheduleId(),
      version: scheduleSchemaVersion,
      workflowId: input.workflowId,
      name: input.name.trim() || 'Schedule',
      enabled: input.enabled ?? true,
      kind: input.kind,
      intervalMs,
      cron: input.kind === 'cron' ? (input.cron?.trim() || '* * * * *') : null,
      lastRunAt: null,
      nextRunAt: intervalMs ? nextIntervalAt(now, intervalMs) : null,
      createdAt: now,
      updatedAt: now,
    });

    const nextSchedules = [schedule, ...get().schedules];
    persistSchedules(nextSchedules);
    set({ schedules: nextSchedules });
    return schedule;
  },
  updateSchedule: (scheduleId, input) => {
    let updated: Schedule | null = null;

    const nextSchedules = get().schedules.map((schedule) => {
      if (schedule.id !== scheduleId) {
        return schedule;
      }

      const merged = {
        ...schedule,
        ...input,
        updatedAt: new Date().toISOString(),
      };
      updated = scheduleSchema.parse(merged);
      return updated;
    });

    if (!updated) {
      return null;
    }

    persistSchedules(nextSchedules);
    set({ schedules: nextSchedules });
    return updated;
  },
  deleteSchedule: (scheduleId) => {
    const nextSchedules = get().schedules.filter((schedule) => schedule.id !== scheduleId);
    persistSchedules(nextSchedules);
    set({ schedules: nextSchedules });
  },
  toggleSchedule: (scheduleId, enabled) => {
    return get().updateSchedule(scheduleId, { enabled });
  },
  getSchedulesByWorkflowId: (workflowId) => {
    return get().schedules
      .filter((schedule) => schedule.workflowId === workflowId)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  },
}));

if (hasAsyncLoad(persistence)) {
  void persistence
    .loadAsync()
    .then((persisted) => {
      useScheduleStore.setState({
        schedules: persisted.schedules,
      });
    })
    .catch(() => {
      // TODO(extension): add telemetry hook for async schedule hydration failures.
    });
}
