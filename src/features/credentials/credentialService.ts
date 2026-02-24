import type { CredentialRef } from '../../domain/credential';
import { credentialRefListSchema, credentialRefSchema } from '../../schemas/credentialSchemas';
import { toolRegistrySchema, toolRegistrySchemaVersion } from '../../schemas/toolRegistry';
import { isTauriRuntime } from '../../lib/runtime';
import { createToolId } from '../../lib/ids';
import { STORAGE_KEYS } from '../../storage/keys';
import { createSqliteStorageEngine } from '../../storage/sqlite/SqliteStorageEngine';

const LOCAL_CREDENTIAL_PROVIDER = 'web';

type CredentialEngine = {
  listCredentials: () => Promise<CredentialRef[]>;
  createCredential: (ref: CredentialRef) => Promise<void>;
  updateCredentialLastUsed: (id: string, ts: number | null) => Promise<void>;
  deleteCredential: (id: string) => Promise<void>;
};

let sqliteCredentialEngine: CredentialEngine | null = null;

const getSqliteCredentialEngine = (): CredentialEngine => {
  if (!sqliteCredentialEngine) {
    sqliteCredentialEngine = createSqliteStorageEngine({
      key: STORAGE_KEYS.tools,
      schema: toolRegistrySchema,
      defaultValue: {
        version: toolRegistrySchemaVersion,
        tools: [],
      },
    });
  }

  return sqliteCredentialEngine;
};

const loadLocalCredentials = (): CredentialRef[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.credentials);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    const result = credentialRefListSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
};

const saveLocalCredentials = (credentials: CredentialRef[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEYS.credentials, JSON.stringify(credentials));
  } catch {
    // TODO(extension): add telemetry for credential metadata persistence failures.
  }
};

export const createCredentialRef = (label: string, provider = LOCAL_CREDENTIAL_PROVIDER): CredentialRef => {
  return credentialRefSchema.parse({
    id: createToolId(),
    provider,
    label: label.trim(),
    createdAt: Date.now(),
    lastUsedAt: null,
  });
};

export const listCredentialRefs = async (): Promise<CredentialRef[]> => {
  if (isTauriRuntime()) {
    return getSqliteCredentialEngine().listCredentials();
  }

  return loadLocalCredentials();
};

export const upsertCredentialRef = async (credential: CredentialRef): Promise<void> => {
  const parsed = credentialRefSchema.parse(credential);

  if (isTauriRuntime()) {
    await getSqliteCredentialEngine().createCredential(parsed);
    return;
  }

  const existing = loadLocalCredentials().filter((entry) => entry.id !== parsed.id);
  saveLocalCredentials([...existing, parsed]);
};

export const updateCredentialLastUsed = async (credentialId: string, timestamp: number | null): Promise<void> => {
  if (isTauriRuntime()) {
    await getSqliteCredentialEngine().updateCredentialLastUsed(credentialId, timestamp);
    return;
  }

  const credentials = loadLocalCredentials().map((entry) =>
    entry.id === credentialId
      ? {
          ...entry,
          lastUsedAt: timestamp,
        }
      : entry,
  );
  saveLocalCredentials(credentials);
};

export const deleteCredentialRef = async (credentialId: string): Promise<void> => {
  if (isTauriRuntime()) {
    await getSqliteCredentialEngine().deleteCredential(credentialId);
    return;
  }

  saveLocalCredentials(loadLocalCredentials().filter((entry) => entry.id !== credentialId));
};

export const replaceCredentialRefs = async (credentials: CredentialRef[]): Promise<void> => {
  const parsed = credentialRefListSchema.parse(credentials);

  if (isTauriRuntime()) {
    const engine = getSqliteCredentialEngine();
    const existing = await engine.listCredentials();

    await Promise.all(existing.map((entry) => engine.deleteCredential(entry.id)));
    await Promise.all(parsed.map((entry) => engine.createCredential(entry)));
    return;
  }

  saveLocalCredentials(parsed);
};
