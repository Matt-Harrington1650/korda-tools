import type { ComponentType } from 'react';
import type { ZodType } from 'zod';
import type { ToolType } from '../domain/tool';
import type { ToolAdapter } from '../execution/ToolAdapter';
import type { ToolCapabilityFlags } from '../execution/types';

export type PluginConfigPanelProps = {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
  errors?: string[];
};

export type PluginDetailPanelProps = {
  value: Record<string, unknown>;
};

export type PluginManifest<TConfig = unknown> = {
  id: string;
  version: string;
  displayName: string;
  toolType: ToolType;
  capabilities: ToolCapabilityFlags;
  configSchema: ZodType<TConfig>;
  adapterFactory: () => ToolAdapter;
  ui?: {
    ConfigPanel?: ComponentType<PluginConfigPanelProps>;
    DetailPanels?: Array<ComponentType<PluginDetailPanelProps>>;
  };
  migrate?: (oldConfig: unknown, fromVersion: string) => TConfig;
};
