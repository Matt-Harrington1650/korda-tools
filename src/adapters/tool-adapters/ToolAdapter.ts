import type { Tool, ToolType } from '../../domain/tool';

export type AdapterTestResult = {
  ok: boolean;
  message: string;
  latencyMs: number;
};

export interface ToolAdapter {
  type: ToolType;
  testConnection: (tool: Tool) => Promise<AdapterTestResult>;
}

export type ToolExecutionAdapter = ToolAdapter;
