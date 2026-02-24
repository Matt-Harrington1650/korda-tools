import type { z } from 'zod';
import type { appSettingsSchema } from '../schemas/settingsSchemas';

export type AppSettings = z.infer<typeof appSettingsSchema>;
