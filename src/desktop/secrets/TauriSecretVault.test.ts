import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTauriInvoke = vi.fn();

vi.mock('../../lib/tauri', () => {
  return {
    tauriInvoke: mockTauriInvoke,
  };
});

describe('TauriSecretVault', () => {
  beforeEach(() => {
    mockTauriInvoke.mockReset();
  });

  it('calls secret_set via invoke', async () => {
    const { TauriSecretVault } = await import('./TauriSecretVault');
    const vault = new TauriSecretVault();

    await vault.setSecret('cred-1', 'super-secret-value');

    expect(mockTauriInvoke).toHaveBeenCalledTimes(1);
    expect(mockTauriInvoke).toHaveBeenCalledWith('secret_set', {
      credential_id: 'cred-1',
      secret_value: 'super-secret-value',
    });
  });

  it('calls secret_get via invoke and returns the secret', async () => {
    mockTauriInvoke.mockResolvedValueOnce('resolved-secret');
    const { TauriSecretVault } = await import('./TauriSecretVault');
    const vault = new TauriSecretVault();

    const secret = await vault.getSecret('cred-2');

    expect(secret).toBe('resolved-secret');
    expect(mockTauriInvoke).toHaveBeenCalledTimes(1);
    expect(mockTauriInvoke).toHaveBeenCalledWith('secret_get', {
      credential_id: 'cred-2',
    });
  });

  it('calls secret_delete via invoke', async () => {
    const { TauriSecretVault } = await import('./TauriSecretVault');
    const vault = new TauriSecretVault();

    await vault.deleteSecret('cred-3');

    expect(mockTauriInvoke).toHaveBeenCalledTimes(1);
    expect(mockTauriInvoke).toHaveBeenCalledWith('secret_delete', {
      credential_id: 'cred-3',
    });
  });

  it('web vault throws not supported', async () => {
    const { WebSecretVault } = await import('./WebSecretVault');
    const vault = new WebSecretVault();

    await expect(vault.setSecret('cred-web', 'secret')).rejects.toThrow('not supported');
    await expect(vault.getSecret('cred-web')).rejects.toThrow('not supported');
    await expect(vault.deleteSecret('cred-web')).rejects.toThrow('not supported');
  });
});
