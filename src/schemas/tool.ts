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

export const httpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

export const toolHeaderSchema = z.object({
  key: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(500),
});

export const toolSchema = z.object({
  id: z.string().min(1),
  version: z.literal(toolSchemaVersion),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240),
  category: z.string().trim().min(1).max(40),
  tags: z.array(z.string().trim().min(1).max(30)).max(20),
  type: toolTypeSchema,
  authType: authTypeSchema,
  endpoint: z.string().trim().url(),
  method: httpMethodSchema.nullable(),
  headers: z.array(toolHeaderSchema),
  samplePayload: z.string().trim(),
  status: toolStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createToolInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240),
  category: z.string().trim().min(1).max(40).default('general'),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  type: toolTypeSchema,
  authType: authTypeSchema,
  endpoint: z.string().trim().url(),
  method: httpMethodSchema.nullable().default(null),
  headers: z.array(toolHeaderSchema).default([]),
  samplePayload: z.string().trim().default(''),
  status: toolStatusSchema,
});

export const updateToolInputSchema = createToolInputSchema.partial();

export type Tool = z.infer<typeof toolSchema>;
export type ToolType = z.infer<typeof toolTypeSchema>;
export type AuthType = z.infer<typeof authTypeSchema>;
export type ToolStatus = z.infer<typeof toolStatusSchema>;
export type HttpMethod = z.infer<typeof httpMethodSchema>;
export type ToolHeader = z.infer<typeof toolHeaderSchema>;
export type CreateToolInput = z.infer<typeof createToolInputSchema>;
export type UpdateToolInput = z.infer<typeof updateToolInputSchema>;
