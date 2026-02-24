import { create } from 'zustand';
import type { CreateToolInput, Tool, UpdateToolInput } from '../../../domain/tool';
import { createToolId } from '../../../lib/ids';
import { createToolInputSchema, toolSchema, toolSchemaVersion, updateToolInputSchema } from '../../../schemas/tool';
import { toolRegistrySchema, toolRegistrySchemaVersion } from '../../../schemas/toolRegistry';
import { createLocalStoragePersistence } from '../../../storage/localStoragePersistence';
import { seedTools } from '../seedTools';

const TOOL_REGISTRY_STORAGE_KEY = 'ai-tool-hub/tool-registry/v1';

const persistence = createLocalStoragePersistence({
  key: TOOL_REGISTRY_STORAGE_KEY,
  schema: toolRegistrySchema,
});

const persistTools = (tools: Tool[]): void => {
  persistence.save({
    version: toolRegistrySchemaVersion,
    tools,
  });
};

const resolveInitialTools = (): Tool[] => {
  const persisted = persistence.load();

  if (persisted?.tools.length) {
    return persisted.tools;
  }

  persistTools(seedTools);
  return seedTools;
};

export type DashboardLayout = 'grid' | 'list';

type ToolRegistryState = {
  tools: Tool[];
  dashboardLayout: DashboardLayout;
  setDashboardLayout: (layout: DashboardLayout) => void;
  createTool: (input: CreateToolInput) => Tool;
  updateTool: (id: string, input: UpdateToolInput) => Tool | null;
  deleteTool: (id: string) => void;
  getToolById: (id: string) => Tool | undefined;
  resetToSeedData: () => void;
};

const initialTools = resolveInitialTools();

export const useToolRegistryStore = create<ToolRegistryState>((set, get) => ({
  tools: initialTools,
  dashboardLayout: 'grid',
  setDashboardLayout: (layout) => {
    set({ dashboardLayout: layout });
  },
  createTool: (input) => {
    const parsedInput = createToolInputSchema.parse(input);
    const timestamp = new Date().toISOString();

    const tool = toolSchema.parse({
      id: createToolId(),
      version: toolSchemaVersion,
      ...parsedInput,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const nextTools = [tool, ...get().tools];
    persistTools(nextTools);
    set({ tools: nextTools });
    return tool;
  },
  updateTool: (id, input) => {
    const parsedInput = updateToolInputSchema.parse(input);
    let updatedTool: Tool | null = null;

    const nextTools = get().tools.map((tool) => {
      if (tool.id !== id) {
        return tool;
      }

      updatedTool = toolSchema.parse({
        ...tool,
        ...parsedInput,
        updatedAt: new Date().toISOString(),
      });

      return updatedTool;
    });

    if (updatedTool) {
      persistTools(nextTools);
      set({ tools: nextTools });
    }

    return updatedTool;
  },
  deleteTool: (id) => {
    const nextTools = get().tools.filter((tool) => tool.id !== id);
    persistTools(nextTools);
    set({ tools: nextTools });
  },
  getToolById: (id) => {
    return get().tools.find((tool) => tool.id === id);
  },
  resetToSeedData: () => {
    persistTools(seedTools);
    set({ tools: seedTools });
  },
}));
