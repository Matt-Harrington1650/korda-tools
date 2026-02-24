import { z } from 'zod';

export const toolRunLogSchemaVersion = 1 as const;

export const toolRunActionTypeSchema = z.enum(['test', 'run']);

export const toolRunRequestSummarySchema = z.object({
  method: z.string(),
  url: z.string(),
  headers: z.record(z.string(), z.string()),
  payloadPreview: z.string(),
});

export const toolRunResponseSummarySchema = z.object({
  statusCode: z.number().nullable(),
  preview: z.string(),
  durationMs: z.number().int().nonnegative(),
});

export const toolRunLogSchema = z.object({
  id: z.string().min(1),
  version: z.literal(toolRunLogSchemaVersion),
  toolId: z.string().min(1),
  timestamp: z.string().datetime(),
  actionType: toolRunActionTypeSchema,
  requestSummary: toolRunRequestSummarySchema,
  responseSummary: toolRunResponseSummarySchema,
  success: z.boolean(),
  errorDetails: z.string(),
});

export const toolRunLogHistorySchema = z.object({
  version: z.literal(toolRunLogSchemaVersion),
  entries: z.array(toolRunLogSchema),
});

export type ToolRunActionType = z.infer<typeof toolRunActionTypeSchema>;
export type ToolRunRequestSummary = z.infer<typeof toolRunRequestSummarySchema>;
export type ToolRunResponseSummary = z.infer<typeof toolRunResponseSummarySchema>;
export type ToolRunLog = z.infer<typeof toolRunLogSchema>;
export type ToolRunLogHistory = z.infer<typeof toolRunLogHistorySchema>;

// Backward-compatible aliases for existing imports.
export const logSchemaVersion = toolRunLogSchemaVersion;
export const logEntrySchema = toolRunLogSchema;
export const logHistorySchema = toolRunLogHistorySchema;
