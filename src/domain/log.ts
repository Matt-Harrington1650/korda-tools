import type { z } from 'zod';
import type { logEntrySchema, logHistorySchema } from '../schemas/logSchemas';

export type LogEntry = z.infer<typeof logEntrySchema>;
export type LogHistory = z.infer<typeof logHistorySchema>;
