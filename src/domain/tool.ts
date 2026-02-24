import type { z } from 'zod';
import type { createToolInputSchema, toolSchema, toolStatusSchema, toolTypeSchema, updateToolInputSchema } from '../schemas/tool';

export type Tool = z.infer<typeof toolSchema>;
export type ToolType = z.infer<typeof toolTypeSchema>;
export type ToolStatus = z.infer<typeof toolStatusSchema>;

export type CreateToolInput = z.infer<typeof createToolInputSchema>;
export type UpdateToolInput = z.infer<typeof updateToolInputSchema>;
