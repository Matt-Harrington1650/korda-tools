import { z } from 'zod';

export const toolSchemaVersion = 1 as const;

export const toolTypeSchema = z.enum(['rest', 'graphql', 'webhook']);
export const toolStatusSchema = z.enum(['healthy', 'degraded', 'offline']);

export const toolSchema = z.object({
  id: z.string().min(1),
  version: z.literal(toolSchemaVersion),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240),
  type: toolTypeSchema,
  endpoint: z.string().trim().url(),
  status: toolStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createToolInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240),
  type: toolTypeSchema,
  endpoint: z.string().trim().url(),
  status: toolStatusSchema,
});

export const updateToolInputSchema = createToolInputSchema.partial();
