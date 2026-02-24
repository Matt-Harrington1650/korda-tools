import { z } from 'zod';

export const settingsSchemaVersion = 1 as const;

export const dashboardLayoutSchema = z.enum(['grid', 'list']);
export const themePreferenceSchema = z.enum(['system', 'light', 'dark']);

export const appSettingsSchema = z.object({
  version: z.literal(settingsSchemaVersion),
  dashboardLayout: dashboardLayoutSchema,
  theme: themePreferenceSchema,
  lastVisitedToolId: z.string().min(1).nullable(),
});
