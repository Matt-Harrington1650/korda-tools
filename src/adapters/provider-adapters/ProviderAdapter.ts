import type { Provider } from '../../domain/provider';

export type ProviderHealthResult = {
  ok: boolean;
  message: string;
  checkedAt: string;
};

export interface ProviderAdapter {
  type: Provider['type'];
  checkHealth: (provider: Provider) => Promise<ProviderHealthResult>;
}
