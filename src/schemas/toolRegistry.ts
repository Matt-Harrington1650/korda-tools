import { z } from 'zod';
import { toolSchema } from './tool';

export const toolRegistrySchemaVersion = 1 as const;

export const toolRegistrySchema = z.object({
  version: z.literal(toolRegistrySchemaVersion),
  tools: z.array(toolSchema),
});

export type PersistedToolRegistry = z.infer<typeof toolRegistrySchema>;
