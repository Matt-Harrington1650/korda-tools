import { z } from 'zod';

export const logSchemaVersion = 1 as const;
export const logLevelSchema = z.enum(['info', 'warning', 'error']);

export const logEntrySchema = z.object({
  id: z.string().min(1),
  version: z.literal(logSchemaVersion),
  level: logLevelSchema,
  message: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  context: z.record(z.string(), z.string()).optional(),
});

export const logHistorySchema = z.object({
  version: z.literal(logSchemaVersion),
  entries: z.array(logEntrySchema),
});
