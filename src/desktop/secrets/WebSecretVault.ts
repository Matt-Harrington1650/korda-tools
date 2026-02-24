import type { SecretVault } from './SecretVault';

export class WebSecretVault implements SecretVault {
  async setSecret(_credentialId: string, _secretValue: string): Promise<void> {
    throw new Error('not supported');
  }

  async getSecret(_credentialId: string): Promise<string> {
    throw new Error('not supported');
  }

  async deleteSecret(_credentialId: string): Promise<void> {
    throw new Error('not supported');
  }
}
