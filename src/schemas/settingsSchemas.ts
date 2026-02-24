import { z } from 'zod';

export const settingsSchemaVersion = 1 as const;

export const dashboardLayoutSchema = z.enum(['grid', 'list']);
export const themePreferenceSchema = z.enum(['system', 'light', 'dark']);

export const settingsSchema = z.object({
  version: z.literal(settingsSchemaVersion),
  dashboardLayout: dashboardLayoutSchema,
  theme: themePreferenceSchema,
  lastVisitedToolId: z.string().min(1).nullable(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>;
export type ThemePreference = z.infer<typeof themePreferenceSchema>;

// Backward-compatible alias for existing imports.
export const appSettingsSchema = settingsSchema;
