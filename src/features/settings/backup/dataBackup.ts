import { z } from 'zod';
import type { CredentialRef } from '../../../domain/credential';
import type { ToolRunLog } from '../../../domain/log';
import type { Settings } from '../../../domain/settings';
import type { Tool } from '../../../domain/tool';
import { credentialRefSchema } from '../../../schemas/credentialSchemas';
import { toolRunLogSchema } from '../../../schemas/logSchemas';
import { settingsSchema } from '../../../schemas/settingsSchemas';
import { toolSchema } from '../../../schemas/tool';
import { redactHeaders, redactText } from '../../tools/logRedaction';

export const dataExportSchemaVersion = 1 as const;

export const dataExportSchema = z.object({
  version: z.literal(dataExportSchemaVersion),
  exportedAt: z.string().datetime(),
  tools: z.array(toolSchema),
  settings: settingsSchema,
  logs: z.array(toolRunLogSchema),
  credentials: z.array(credentialRefSchema),
});

export type DataExportPayload = z.infer<typeof dataExportSchema>;

type CreateDataExportPayloadInput = {
  tools: Tool[];
  settings: Settings;
  logs: ToolRunLog[];
  credentials: CredentialRef[];
  exportedAt?: string;
};

export type DataRestorePayload = {
  tools: Tool[];
  settings: Settings;
  logs: ToolRunLog[];
  credentials: CredentialRef[];
};

const sanitizeLog = (entry: ToolRunLog): ToolRunLog => {
  const parsed = toolRunLogSchema.parse(entry);

  return {
    ...parsed,
    requestSummary: {
      ...parsed.requestSummary,
      headers: redactHeaders(parsed.requestSummary.headers),
      payloadPreview: redactText(parsed.requestSummary.payloadPreview),
    },
    responseSummary: {
      ...parsed.responseSummary,
      preview: redactText(parsed.responseSummary.preview),
    },
    errorDetails: redactText(parsed.errorDetails),
  };
};

const sanitizeTool = (tool: Tool): Tool => {
  return toolSchema.parse(tool);
};

export const createDataExportPayload = ({
  tools,
  settings,
  logs,
  credentials,
  exportedAt = new Date().toISOString(),
}: CreateDataExportPayloadInput): DataExportPayload => {
  const payload = {
    version: dataExportSchemaVersion,
    exportedAt,
    tools: tools.map(sanitizeTool),
    settings: settingsSchema.parse(settings),
    logs: logs.map(sanitizeLog),
    credentials: credentials.map((credential) => credentialRefSchema.parse(credential)),
  };

  return dataExportSchema.parse(payload);
};

export const serializeDataExportPayload = (payload: DataExportPayload): string => {
  return JSON.stringify(payload, null, 2);
};

export const parseDataExportPayload = (rawJson: string): DataExportPayload => {
  const parsed = JSON.parse(rawJson) as unknown;
  return dataExportSchema.parse(parsed);
};

export const createRestorePayload = (payload: DataExportPayload): DataRestorePayload => {
  const parsed = dataExportSchema.parse(payload);

  return {
    settings: settingsSchema.parse(parsed.settings),
    credentials: parsed.credentials.map((credential) => credentialRefSchema.parse(credential)),
    logs: parsed.logs.map(sanitizeLog),
    tools: parsed.tools.map((tool) => {
      const normalizedTool = sanitizeTool(tool);

      if (normalizedTool.authType === 'none') {
        return normalizedTool;
      }

      return {
        ...normalizedTool,
        status: 'missing_credentials',
      };
    }),
  };
};
