import { ToolAdapterRegistry } from './ToolAdapterRegistry';
import { customPluginAdapter } from './adapters/customPluginAdapter';
import { openAiCompatibleAdapter } from './adapters/openAiCompatibleAdapter';
import { restApiAdapter } from './adapters/restApiAdapter';
import { webhookAdapter } from './adapters/webhookAdapter';

export const toolAdapterRegistry = new ToolAdapterRegistry();

toolAdapterRegistry.register(restApiAdapter);
toolAdapterRegistry.register(openAiCompatibleAdapter);
toolAdapterRegistry.register(webhookAdapter);
toolAdapterRegistry.register(customPluginAdapter);
