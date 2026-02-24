import { customPluginAdapter } from '../execution/adapters/customPluginAdapter';
import { openAiCompatibleAdapter } from '../execution/adapters/openAiCompatibleAdapter';
import { restApiAdapter } from '../execution/adapters/restApiAdapter';
import { webhookAdapter } from '../execution/adapters/webhookAdapter';
import {
  customPluginConfigSchema,
  openAiCompatiblePluginConfigSchema,
  restApiPluginConfigSchema,
  webhookPluginConfigSchema,
} from './schemas';
import type { PluginManifest } from './PluginManifest';
import {
  CustomPluginConfigPanel,
  OpenAiCompatibleConfigPanel,
  RestApiConfigPanel,
  WebhookConfigPanel,
} from './ui/BuiltinConfigPanels';

export const builtInPluginManifests: PluginManifest[] = [
  {
    id: 'builtin.rest_api',
    version: '1.0.0',
    displayName: 'REST API',
    toolType: 'rest_api',
    capabilities: restApiAdapter.capabilities,
    configSchema: restApiPluginConfigSchema,
    adapterFactory: () => restApiAdapter,
    ui: {
      ConfigPanel: RestApiConfigPanel,
    },
  },
  {
    id: 'builtin.openai_compatible',
    version: '1.0.0',
    displayName: 'OpenAI Compatible',
    toolType: 'openai_compatible',
    capabilities: openAiCompatibleAdapter.capabilities,
    configSchema: openAiCompatiblePluginConfigSchema,
    adapterFactory: () => openAiCompatibleAdapter,
    ui: {
      ConfigPanel: OpenAiCompatibleConfigPanel,
    },
  },
  {
    id: 'builtin.webhook',
    version: '1.0.0',
    displayName: 'Webhook',
    toolType: 'webhook',
    capabilities: webhookAdapter.capabilities,
    configSchema: webhookPluginConfigSchema,
    adapterFactory: () => webhookAdapter,
    ui: {
      ConfigPanel: WebhookConfigPanel,
    },
  },
  {
    id: 'builtin.custom_plugin',
    version: '1.0.0',
    displayName: 'Custom Plugin',
    toolType: 'custom_plugin',
    capabilities: customPluginAdapter.capabilities,
    configSchema: customPluginConfigSchema,
    adapterFactory: () => customPluginAdapter,
    ui: {
      ConfigPanel: CustomPluginConfigPanel,
    },
  },
];
