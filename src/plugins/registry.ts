import { builtInPluginManifests } from './builtinPlugins';
import { PluginRegistry } from './PluginRegistry';

export const pluginRegistry = new PluginRegistry();

pluginRegistry.registerMany(builtInPluginManifests);
