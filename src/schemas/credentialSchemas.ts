import { z } from 'zod';

export const credentialRefSchema = z.object({
  id: z.string().uuid(),
  provider: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  createdAt: z.number().int().nonnegative(),
  lastUsedAt: z.number().int().nonnegative().nullable(),
});

export const credentialRefListSchema = z.array(credentialRefSchema);

export type CredentialRef = z.infer<typeof credentialRefSchema>;
