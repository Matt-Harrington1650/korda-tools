import { isTauriRuntime } from '../../lib/runtime';
import type { SecretVault } from './SecretVault';
import { TauriSecretVault } from './TauriSecretVault';
import { WebSecretVault } from './WebSecretVault';

export const createSecretVault = (): SecretVault => {
  if (isTauriRuntime()) {
    return new TauriSecretVault();
  }

  return new WebSecretVault();
};
