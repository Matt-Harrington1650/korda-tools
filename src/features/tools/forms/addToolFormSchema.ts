import { z } from 'zod';
import { authTypeSchema, toolStatusSchema, toolTypeSchema } from '../../../schemas/tool';

export const addToolFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(80),
    description: z.string().trim().max(240),
    category: z.string().trim().min(1, 'Category is required.').max(40),
    toolType: toolTypeSchema,
    authType: authTypeSchema,
    customHeaderName: z.string().trim(),
    credentialMode: z.enum(['existing', 'new']),
    credentialRefId: z.string().trim(),
    credentialLabel: z.string().trim(),
    credentialSecret: z.string(),
    tags: z.string().trim(),
    status: toolStatusSchema,
  })
  .superRefine((value, context) => {
    const requiresCredential = value.authType !== 'none';

    if (value.authType === 'custom_header' && value.customHeaderName.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customHeaderName'],
        message: 'Custom header name is required for custom header auth.',
      });
    }

    if (requiresCredential && value.credentialMode === 'existing' && value.credentialRefId.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['credentialRefId'],
        message: 'Select an existing credential.',
      });
    }

    if (requiresCredential && value.credentialMode === 'new') {
      if (value.credentialLabel.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['credentialLabel'],
          message: 'Credential label is required.',
        });
      }

      if (value.credentialSecret.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['credentialSecret'],
          message: 'Credential secret is required.',
        });
      }
    }
  });

export type AddToolFormValues = z.infer<typeof addToolFormSchema>;
