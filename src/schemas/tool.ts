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

export const toolRetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(10),
  backoffMs: z.number().int().min(0).max(120_000),
  backoffMultiplier: z.number().min(1).max(10).default(2),
  maxBackoffMs: z.number().int().min(0).max(300_000).optional(),
  retryableStatusCodes: z.array(z.number().int().min(100).max(599)).max(20).optional(),
});

export const toolConcurrencySchema = z.object({
  maxConcurrentRuns: z.number().int().min(1).max(20),
});

export const toolExecutionPolicySchema = z.object({
  timeoutMs: z.number().int().min(250).max(300_000).optional(),
  retry: toolRetryPolicySchema.optional(),
  concurrency: toolConcurrencySchema.optional(),
});

export const toolConfigSchemaVersion = '1.0.0' as const;

const enforceAuthFields = (
  value: {
    authType: z.infer<typeof authTypeSchema>;
    credentialRefId?: string | null;
    customHeaderName?: string | null;
  },
  context: z.RefinementCtx,
): void => {
  const authEnabled = value.authType !== 'none';

  if (authEnabled && !value.credentialRefId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['credentialRefId'],
      message: 'Credential reference is required when auth is enabled.',
    });
  }

  if (value.authType === 'custom_header' && !value.customHeaderName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customHeaderName'],
      message: 'Custom header name is required for custom header auth.',
    });
  }
};

export const toolSchema = z
  .object({
    id: z.string().min(1),
    version: z.literal(toolSchemaVersion),
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(240),
    category: z.string().trim().min(1).max(40),
    tags: z.array(z.string().trim().min(1).max(30)).max(20),
    type: toolTypeSchema,
    authType: authTypeSchema,
    credentialRefId: z.string().trim().min(1).max(120).optional(),
    customHeaderName: z.string().trim().min(1).max(120).optional(),
    endpoint: z.string().trim().url(),
    method: httpMethodSchema.nullable(),
    headers: z.array(toolHeaderSchema),
    samplePayload: z.string().trim(),
    configVersion: z.string().trim().min(1).default(toolConfigSchemaVersion),
    config: z.record(z.string(), z.unknown()).default({}),
    executionPolicy: toolExecutionPolicySchema.optional(),
    status: toolStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine(enforceAuthFields);

const createToolInputBaseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240),
  category: z.string().trim().min(1).max(40).default('general'),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  type: toolTypeSchema,
  authType: authTypeSchema,
  credentialRefId: z.string().trim().min(1).max(120).optional(),
  customHeaderName: z.string().trim().min(1).max(120).optional(),
  endpoint: z.string().trim().url(),
  method: httpMethodSchema.nullable().default(null),
  headers: z.array(toolHeaderSchema).default([]),
  samplePayload: z.string().trim().default(''),
  configVersion: z.string().trim().min(1).default(toolConfigSchemaVersion),
  config: z.record(z.string(), z.unknown()).default({}),
  executionPolicy: toolExecutionPolicySchema.optional(),
  status: toolStatusSchema,
});

export const createToolInputSchema = createToolInputBaseSchema.superRefine(enforceAuthFields);

export const updateToolInputSchema = createToolInputBaseSchema.partial();

export type Tool = z.infer<typeof toolSchema>;
export type ToolType = z.infer<typeof toolTypeSchema>;
export type AuthType = z.infer<typeof authTypeSchema>;
export type ToolStatus = z.infer<typeof toolStatusSchema>;
export type HttpMethod = z.infer<typeof httpMethodSchema>;
export type ToolHeader = z.infer<typeof toolHeaderSchema>;
export type ToolRetryPolicy = z.infer<typeof toolRetryPolicySchema>;
export type ToolConcurrency = z.infer<typeof toolConcurrencySchema>;
export type ToolExecutionPolicy = z.infer<typeof toolExecutionPolicySchema>;
export type CreateToolInput = z.infer<typeof createToolInputSchema>;
export type UpdateToolInput = z.infer<typeof updateToolInputSchema>;
