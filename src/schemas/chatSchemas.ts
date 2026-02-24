import { z } from 'zod';
import { toolRunActionTypeSchema } from './logSchemas';

export const chatThreadSchemaVersion = 1 as const;

export const chatMessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export const chatToolCallStatusSchema = z.enum(['running', 'succeeded', 'failed', 'cancelled']);

export const chatMessageSchema = z.object({
  id: z.string().trim().min(1),
  role: chatMessageRoleSchema,
  content: z.string(),
  timestamp: z.string().datetime(),
  toolCallId: z.string().trim().min(1).optional(),
});

export const chatToolCallTraceSchema = z.object({
  id: z.string().trim().min(1),
  toolId: z.string().trim().min(1),
  toolName: z.string().trim().min(1),
  actionType: toolRunActionTypeSchema,
  payload: z.string(),
  status: chatToolCallStatusSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  requestSummary: z.string(),
  responseSummary: z.string(),
  output: z.string(),
  errorMessage: z.string(),
});

export const chatThreadSchema = z.object({
  id: z.string().trim().min(1),
  version: z.literal(chatThreadSchemaVersion),
  title: z.string().trim().min(1).max(120),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  messages: z.array(chatMessageSchema),
  toolCalls: z.array(chatToolCallTraceSchema),
});

export const chatThreadRegistrySchema = z.object({
  version: z.literal(chatThreadSchemaVersion),
  threads: z.array(chatThreadSchema),
});

export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;
export type ChatToolCallStatus = z.infer<typeof chatToolCallStatusSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatToolCallTrace = z.infer<typeof chatToolCallTraceSchema>;
export type ChatThread = z.infer<typeof chatThreadSchema>;
export type ChatThreadRegistry = z.infer<typeof chatThreadRegistrySchema>;
