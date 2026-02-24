import type { CredentialRef } from '../../../domain/credential';
import type { Tool } from '../../../domain/tool';

type LegacyToolRecord = Record<string, unknown>;

type LegacySecretMigrationDependencies = {
  isTauriRuntime: boolean;
  nowMs: () => number;
  setSecret: (credentialId: string, secretValue: string) => Promise<void>;
  upsertCredentialRef: (credential: CredentialRef) => Promise<void>;
};

type LegacySecretMigrationResult = {
  tools: Tool[];
  changed: boolean;
};

const isRecord = (value: unknown): value is LegacyToolRecord => {
  return typeof value === 'object' && value !== null;
};

const toStringValue = (value: unknown): string => {
  return typeof value === 'string' ? value : '';
};

const extractLegacySecret = (value: unknown): string => {
  if (!isRecord(value)) {
    return '';
  }

  const candidates = [
    value.apiKey,
    value.api_key,
    value.bearerToken,
    value.token,
    value.customHeaderValue,
    value.secret,
    value.password,
  ];

  for (const candidate of candidates) {
    const next = toStringValue(candidate);
    if (next.length > 0) {
      return next;
    }
  }

  return '';
};

const resolveCustomHeaderName = (tool: Tool, rawRecord: unknown): string | undefined => {
  if (tool.authType !== 'custom_header') {
    return undefined;
  }

  if (tool.customHeaderName) {
    return tool.customHeaderName;
  }

  if (isRecord(rawRecord)) {
    const explicit = toStringValue(rawRecord.customHeaderName);
    if (explicit.length > 0) {
      return explicit;
    }

    if (Array.isArray(rawRecord.headers)) {
      const fromHeader = rawRecord.headers
        .filter(isRecord)
        .map((header) => toStringValue(header.key))
        .find((header) => header.length > 0);

      if (fromHeader) {
        return fromHeader;
      }
    }
  }

  return 'X-Custom-Auth';
};

const buildCredentialRefId = (toolId: string): string => `cred-${toolId}`;

export const migrateLegacyToolSecrets = async (
  tools: Tool[],
  rawToolRecords: unknown,
  dependencies: LegacySecretMigrationDependencies,
): Promise<LegacySecretMigrationResult> => {
  if (!Array.isArray(rawToolRecords) || rawToolRecords.length === 0) {
    return { tools, changed: false };
  }

  const rawById = new Map<string, LegacyToolRecord>();
  rawToolRecords.filter(isRecord).forEach((record) => {
    const id = toStringValue(record.id);
    if (id.length > 0) {
      rawById.set(id, record);
    }
  });

  const nextTools: Tool[] = [];
  let changed = false;

  for (const tool of tools) {
    if (tool.authType === 'none') {
      nextTools.push(tool);
      continue;
    }

    const raw = rawById.get(tool.id);
    const legacySecret = extractLegacySecret(raw);
    const credentialRefId = tool.credentialRefId || buildCredentialRefId(tool.id);
    const customHeaderName = resolveCustomHeaderName(tool, raw);
    const credentialChanged = tool.credentialRefId !== credentialRefId;
    const customHeaderChanged = tool.customHeaderName !== customHeaderName;

    if (legacySecret.length > 0) {
      changed = true;

      if (dependencies.isTauriRuntime) {
        await dependencies.setSecret(credentialRefId, legacySecret);
        await dependencies.upsertCredentialRef({
          id: credentialRefId,
          provider: 'keyring',
          label: `Migrated ${tool.name}`,
          createdAt: dependencies.nowMs(),
          lastUsedAt: null,
        });

        nextTools.push({
          ...tool,
          credentialRefId,
          customHeaderName,
          status: tool.status === 'disabled' ? 'disabled' : 'configured',
        });
        continue;
      }

      nextTools.push({
        ...tool,
        credentialRefId,
        customHeaderName,
        status: tool.status === 'disabled' ? 'disabled' : 'missing_credentials',
      });
      continue;
    }

    if (!credentialChanged && !customHeaderChanged) {
      nextTools.push(tool);
      continue;
    }

    changed = true;
    nextTools.push({
      ...tool,
      credentialRefId,
      customHeaderName,
    });
  }

  return {
    tools: changed ? nextTools : tools,
    changed,
  };
};
