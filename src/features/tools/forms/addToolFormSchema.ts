import { z } from 'zod';
import { authTypeSchema, httpMethodSchema, toolTypeSchema } from '../../../schemas/tool';

export const addToolHeaderRowSchema = z
  .object({
    key: z.string().trim(),
    value: z.string().trim(),
  })
  .superRefine((value, context) => {
    const hasKey = value.key.length > 0;
    const hasValue = value.value.length > 0;

    if (hasKey && !hasValue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Header value is required when key is set.',
      });
    }

    if (!hasKey && hasValue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['key'],
        message: 'Header key is required when value is set.',
      });
    }
  });

export const addToolFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(80),
    description: z.string().trim().max(240),
    category: z.string().trim().min(1, 'Category is required.').max(40),
    toolType: toolTypeSchema,
    endpointUrl: z.string().trim(),
    authType: authTypeSchema,
    method: httpMethodSchema.nullable(),
    headers: z.array(addToolHeaderRowSchema).max(20),
    samplePayload: z.string().trim(),
    tags: z.string().trim(),
  })
  .superRefine((value, context) => {
    const requiresEndpoint = value.toolType !== 'custom_plugin';
    const requiresMethod = value.toolType === 'rest_api' || value.toolType === 'webhook';

    if (requiresEndpoint) {
      if (!value.endpointUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endpointUrl'],
          message: 'Endpoint URL is required for this tool type.',
        });
      } else {
        const parsed = z.string().url().safeParse(value.endpointUrl);
        if (!parsed.success) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['endpointUrl'],
            message: 'Enter a valid URL.',
          });
        }
      }
    }

    if (requiresMethod && value.method === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['method'],
        message: 'Method is required for REST API and Webhook tools.',
      });
    }

    if (value.samplePayload) {
      try {
        JSON.parse(value.samplePayload);
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['samplePayload'],
          message: 'Sample payload must be valid JSON.',
        });
      }
    }
  });

export type AddToolFormValues = z.infer<typeof addToolFormSchema>;
