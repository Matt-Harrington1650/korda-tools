import type { SecretVault } from './SecretVault';
import { tauriInvoke } from '../../lib/tauri';

export class TauriSecretVault implements SecretVault {
  async setSecret(credentialId: string, secretValue: string): Promise<void> {
    await tauriInvoke<void>('secret_set', {
      credential_id: credentialId,
      secret_value: secretValue,
    });
  }

  async getSecret(credentialId: string): Promise<string> {
    return tauriInvoke<string>('secret_get', {
      credential_id: credentialId,
    });
  }

  async deleteSecret(credentialId: string): Promise<void> {
    await tauriInvoke<void>('secret_delete', {
      credential_id: credentialId,
    });
  }
}
