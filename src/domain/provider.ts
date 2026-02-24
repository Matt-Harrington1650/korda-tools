export type ProviderType = 'mock' | 'openai-compatible' | 'custom-plugin';
export type ProviderStatus = 'connected' | 'degraded' | 'offline';

export type Provider = {
  id: string;
  type: ProviderType;
  name: string;
  baseUrl?: string;
  status: ProviderStatus;
  createdAt: string;
  updatedAt: string;
};
