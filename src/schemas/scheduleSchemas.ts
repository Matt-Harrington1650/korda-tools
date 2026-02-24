import { z } from 'zod';

export const scheduleSchemaVersion = 1 as const;
export const scheduledRunLogSchemaVersion = 1 as const;

export const scheduleKindSchema = z.enum(['interval', 'cron']);
export const scheduledRunStatusSchema = z.enum(['succeeded', 'failed', 'cancelled', 'skipped']);

export const scheduleSchema = z
  .object({
    id: z.string().trim().min(1),
    version: z.literal(scheduleSchemaVersion),
    workflowId: z.string().trim().min(1),
    name: z.string().trim().min(1).max(120),
    enabled: z.boolean(),
    kind: scheduleKindSchema,
    intervalMs: z.number().int().min(60_000).max(31_536_000_000).nullable(),
    cron: z.string().trim().max(120).nullable(),
    lastRunAt: z.string().datetime().nullable(),
    nextRunAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((value, context) => {
    if (value.kind === 'interval' && value.intervalMs === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['intervalMs'],
        message: 'Interval schedule requires intervalMs.',
      });
    }

    if (value.kind === 'cron' && (!value.cron || value.cron.trim().length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cron'],
        message: 'Cron schedule requires cron expression.',
      });
    }
  });

export const scheduleRegistrySchema = z.object({
  version: z.literal(scheduleSchemaVersion),
  schedules: z.array(scheduleSchema),
});

export const scheduledRunLogSchema = z.object({
  id: z.string().trim().min(1),
  version: z.literal(scheduledRunLogSchemaVersion),
  scheduleId: z.string().trim().min(1),
  workflowId: z.string().trim().min(1),
  workflowRunId: z.string().trim().min(1).nullable(),
  kind: scheduleKindSchema,
  triggeredAt: z.string().datetime(),
  status: scheduledRunStatusSchema,
  message: z.string(),
});

export const scheduledRunLogHistorySchema = z.object({
  version: z.literal(scheduledRunLogSchemaVersion),
  entries: z.array(scheduledRunLogSchema),
});

export type ScheduleKind = z.infer<typeof scheduleKindSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type ScheduleRegistry = z.infer<typeof scheduleRegistrySchema>;
export type ScheduledRunStatus = z.infer<typeof scheduledRunStatusSchema>;
export type ScheduledRunLog = z.infer<typeof scheduledRunLogSchema>;
export type ScheduledRunLogHistory = z.infer<typeof scheduledRunLogHistorySchema>;
