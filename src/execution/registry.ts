import { pluginRegistry } from '../plugins/registry';

// Backward-compatible alias: execution now resolves adapters through PluginRegistry.
export const toolAdapterRegistry = pluginRegistry;
