export interface SecretVault {
  setSecret: (credentialId: string, secretValue: string) => Promise<void>;
  getSecret: (credentialId: string) => Promise<string>;
  deleteSecret: (credentialId: string) => Promise<void>;
}
