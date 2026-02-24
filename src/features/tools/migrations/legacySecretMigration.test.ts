import { describe, expect, it, vi } from 'vitest';
import type { Tool } from '../../../domain/tool';
import { toolConfigSchemaVersion, toolSchemaVersion } from '../../../schemas/tool';
import { migrateLegacyToolSecrets } from './legacySecretMigration';

const createBaseTool = (): Tool => {
  return {
    id: 'tool-legacy',
    version: toolSchemaVersion,
    name: 'Legacy Tool',
    description: '',
    category: 'general',
    tags: [],
    type: 'rest_api',
    authType: 'api_key',
    endpoint: 'https://example.com',
    method: 'GET',
    headers: [],
    samplePayload: '',
    configVersion: toolConfigSchemaVersion,
    config: {
      endpoint: 'https://example.com',
      method: 'GET',
      headers: [],
      samplePayload: '',
    },
    status: 'configured',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  };
};

describe('migrateLegacyToolSecrets', () => {
  it('stores legacy secret in tauri runtime and sets credentialRefId', async () => {
    const setSecret = vi.fn(async () => undefined);
    const upsertCredentialRef = vi.fn(async () => undefined);

    const result = await migrateLegacyToolSecrets(
      [createBaseTool()],
      [
        {
          id: 'tool-legacy',
          apiKey: 'legacy-secret',
        },
      ],
      {
        isTauriRuntime: true,
        nowMs: () => 1_700_000_000_000,
        setSecret,
        upsertCredentialRef,
      },
    );

    expect(result.changed).toBe(true);
    expect(result.tools[0].credentialRefId).toBe('cred-tool-legacy');
    expect(result.tools[0].status).toBe('configured');
    expect(setSecret).toHaveBeenCalledWith('cred-tool-legacy', 'legacy-secret');
    expect(upsertCredentialRef).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cred-tool-legacy',
      }),
    );
  });

  it('migrates legacy secret even when credentialRefId already exists', async () => {
    const setSecret = vi.fn(async () => undefined);
    const upsertCredentialRef = vi.fn(async () => undefined);

    const result = await migrateLegacyToolSecrets(
      [
        {
          ...createBaseTool(),
          credentialRefId: 'cred-tool-legacy',
          status: 'configured',
        },
      ],
      [
        {
          id: 'tool-legacy',
          token: 'legacy-token',
        },
      ],
      {
        isTauriRuntime: true,
        nowMs: () => 1_700_000_000_000,
        setSecret,
        upsertCredentialRef,
      },
    );

    expect(result.changed).toBe(true);
    expect(setSecret).toHaveBeenCalledWith('cred-tool-legacy', 'legacy-token');
    expect(result.tools[0].credentialRefId).toBe('cred-tool-legacy');
  });

  it('marks missing_credentials in web runtime when legacy secret exists', async () => {
    const setSecret = vi.fn(async () => undefined);
    const upsertCredentialRef = vi.fn(async () => undefined);

    const result = await migrateLegacyToolSecrets(
      [createBaseTool()],
      [
        {
          id: 'tool-legacy',
          apiKey: 'legacy-secret',
        },
      ],
      {
        isTauriRuntime: false,
        nowMs: () => 1_700_000_000_000,
        setSecret,
        upsertCredentialRef,
      },
    );

    expect(result.changed).toBe(true);
    expect(result.tools[0].credentialRefId).toBe('cred-tool-legacy');
    expect(result.tools[0].status).toBe('missing_credentials');
    expect(setSecret).not.toHaveBeenCalled();
    expect(upsertCredentialRef).not.toHaveBeenCalled();
  });
});
