import { z } from 'zod';

export const settingsSchemaVersion = 1 as const;

export const themePreferenceSchema = z.enum(['system', 'light', 'dark']);

export const providerDefaultsSchema = z.object({
  openaiBaseUrl: z.string().trim().url('OpenAI base URL must be a valid URL.'),
  defaultModel: z.string().trim().min(1, 'Default model is required.').max(120),
});

export const credentialReferencesSchema = z.object({
  openaiApiKeyRef: z.string().trim().max(120),
  webhookSecretRef: z.string().trim().max(120),
  customHeaderRef: z.string().trim().max(120),
});

export const settingsSchema = z.object({
  version: z.literal(settingsSchemaVersion),
  theme: themePreferenceSchema,
  defaultTimeoutMs: z.number().int().min(500, 'Timeout must be at least 500ms.').max(120_000),
  localStoragePath: z.string().trim().max(260),
  providerDefaults: providerDefaultsSchema,
  credentialReferences: credentialReferencesSchema,
});

export type Settings = z.infer<typeof settingsSchema>;
export type ThemePreference = z.infer<typeof themePreferenceSchema>;
export type ProviderDefaults = z.infer<typeof providerDefaultsSchema>;
export type CredentialReferences = z.infer<typeof credentialReferencesSchema>;

export const settingsFormSchema = settingsSchema.omit({ version: true });
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

// Backward-compatible alias for existing imports.
export const appSettingsSchema = settingsSchema;
