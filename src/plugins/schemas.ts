import { z } from 'zod';
import { httpMethodSchema, toolHeaderSchema } from '../schemas/tool';

export const restApiPluginConfigSchema = z.object({
  endpoint: z.string().trim().url(),
  method: httpMethodSchema,
  headers: z.array(toolHeaderSchema).default([]),
  samplePayload: z.string().default(''),
});

export const openAiCompatiblePluginConfigSchema = z.object({
  endpoint: z.string().trim().url(),
  headers: z.array(toolHeaderSchema).default([]),
  samplePayload: z.string().default(''),
});

export const webhookPluginConfigSchema = z.object({
  endpoint: z.string().trim().url(),
  method: httpMethodSchema.default('POST'),
  headers: z.array(toolHeaderSchema).default([]),
  samplePayload: z.string().default(''),
});

export const customPluginConfigSchema = z.object({
  endpoint: z.string().trim().url().default('https://plugin.local/placeholder'),
  samplePayload: z.string().default(''),
});

export type RestApiPluginConfig = z.infer<typeof restApiPluginConfigSchema>;
export type OpenAiCompatiblePluginConfig = z.infer<typeof openAiCompatiblePluginConfigSchema>;
export type WebhookPluginConfig = z.infer<typeof webhookPluginConfigSchema>;
export type CustomPluginConfig = z.infer<typeof customPluginConfigSchema>;
