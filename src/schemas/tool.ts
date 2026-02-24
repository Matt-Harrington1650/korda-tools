import { z } from 'zod';

export const toolSchemaVersion = 1 as const;

export const toolTypeSchema = z.enum([
  'rest_api',
  'openai_compatible',
  'webhook',
  'custom_plugin',
]);

export const authTypeSchema = z.enum([
  'none',
  'api_key',
  'bearer',
  'custom_header',
]);

export const toolStatusSchema = z.enum([
  'configured',
  'missing_credentials',
  'disabled',
]);

export const toolSchema = z.object({
  id: z.string().min(1),
  version: z.literal(toolSchemaVersion),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240),
  type: toolTypeSchema,
  authType: authTypeSchema,
  endpoint: z.string().trim().url(),
  status: toolStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createToolInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240),
  type: toolTypeSchema,
  authType: authTypeSchema,
  endpoint: z.string().trim().url(),
  status: toolStatusSchema,
});

export const updateToolInputSchema = createToolInputSchema.partial();

export type Tool = z.infer<typeof toolSchema>;
export type ToolType = z.infer<typeof toolTypeSchema>;
export type AuthType = z.infer<typeof authTypeSchema>;
export type ToolStatus = z.infer<typeof toolStatusSchema>;
export type CreateToolInput = z.infer<typeof createToolInputSchema>;
export type UpdateToolInput = z.infer<typeof updateToolInputSchema>;
