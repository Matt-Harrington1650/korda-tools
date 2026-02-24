import { z } from 'zod';

export const toolRunLogSchemaVersion = 1 as const;

export const toolRunStateSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
]);

export const toolRunLogSchema = z.object({
  id: z.string().min(1),
  version: z.literal(toolRunLogSchemaVersion),
  toolId: z.string().min(1),
  state: toolRunStateSchema,
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  requestPayload: z.string().default(''),
  responsePayload: z.string().default(''),
  errorMessage: z.string().default(''),
});

export const toolRunLogHistorySchema = z.object({
  version: z.literal(toolRunLogSchemaVersion),
  entries: z.array(toolRunLogSchema),
});

export type ToolRunState = z.infer<typeof toolRunStateSchema>;
export type ToolRunLog = z.infer<typeof toolRunLogSchema>;
export type ToolRunLogHistory = z.infer<typeof toolRunLogHistorySchema>;

// Backward-compatible aliases for existing imports.
export const logSchemaVersion = toolRunLogSchemaVersion;
export const logEntrySchema = toolRunLogSchema;
export const logHistorySchema = toolRunLogHistorySchema;
