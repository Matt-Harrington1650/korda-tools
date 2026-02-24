import { create } from 'zustand';
import type { CreateToolInput, Tool, UpdateToolInput } from '../../../domain/tool';
import { createToolId } from '../../../lib/ids';
import { createToolInputSchema, toolSchema, toolSchemaVersion, updateToolInputSchema } from '../../../schemas/tool';
import { toolRegistrySchema, toolRegistrySchemaVersion } from '../../../schemas/toolRegistry';
import { createLocalStorageEngine } from '../../../storage/localStorageEngine';
import { migrateTools } from '../../../storage/migrations';
import { STORAGE_KEYS } from '../../../storage/keys';
import { seedTools } from '../seedTools';

const persistence = createLocalStorageEngine({
  key: STORAGE_KEYS.tools,
  schema: toolRegistrySchema,
  defaultValue: {
    version: toolRegistrySchemaVersion,
    tools: seedTools,
  },
  migrate: migrateTools,
});

const persistTools = (tools: Tool[]): void => {
  persistence.save({
    version: toolRegistrySchemaVersion,
    tools,
  });
};

const validatePersistedTools = (value: unknown): Tool[] | null => {
  const parsed = toolRegistrySchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data.tools;
};

const resolveInitialTools = (): Tool[] => {
  const persisted = persistence.load();
  const validatedTools = validatePersistedTools(persisted);

  if (validatedTools && validatedTools.length > 0) {
    return validatedTools;
  }

  persistTools(seedTools);
  return seedTools;
};

export type ViewMode = 'grid' | 'list';
export type DashboardLayout = ViewMode;

export type ToolRegistryFilters = {
  search: string;
  tags: string[];
  category: string | null;
  viewMode: ViewMode;
};

type ToolRegistryState = {
  tools: Tool[];
  selectedToolId?: string;
  filters: ToolRegistryFilters;
  loadTools: () => void;
  addTool: (input: CreateToolInput) => Tool;
  updateTool: (id: string, input: UpdateToolInput) => Tool | null;
  deleteTool: (id: string) => void;
  setSearch: (search: string) => void;
  setCategory: (category: string | null) => void;
  toggleTag: (tag: string) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setSelectedToolId: (toolId?: string) => void;
  // Backward-compatible aliases
  setDashboardLayout: (layout: DashboardLayout) => void;
  createTool: (input: CreateToolInput) => Tool;
  getToolById: (id: string) => Tool | undefined;
  resetToSeedData: () => void;
};

const initialTools = resolveInitialTools();

export const useToolRegistryStore = create<ToolRegistryState>((set, get) => ({
  tools: initialTools,
  selectedToolId: undefined,
  filters: {
    search: '',
    tags: [],
    category: null,
    viewMode: 'grid',
  },
  loadTools: () => {
    const persisted = persistence.load();
    const validatedTools = validatePersistedTools(persisted);

    if (!validatedTools || validatedTools.length === 0) {
      persistTools(seedTools);
      set({ tools: seedTools });
      return;
    }

    set({ tools: validatedTools });
  },
  addTool: (input) => {
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
    set((state) => ({
      tools: nextTools,
      selectedToolId: state.selectedToolId === id ? undefined : state.selectedToolId,
    }));
  },
  setSearch: (search) => {
    set((state) => ({
      filters: {
        ...state.filters,
        search,
      },
    }));
  },
  setCategory: (category) => {
    set((state) => ({
      filters: {
        ...state.filters,
        category,
      },
    }));
  },
  toggleTag: (tag) => {
    set((state) => {
      const tagExists = state.filters.tags.includes(tag);
      return {
        filters: {
          ...state.filters,
          tags: tagExists ? state.filters.tags.filter((item) => item !== tag) : [...state.filters.tags, tag],
        },
      };
    });
  },
  setViewMode: (viewMode) => {
    set((state) => ({
      filters: {
        ...state.filters,
        viewMode,
      },
    }));
  },
  setSelectedToolId: (toolId) => {
    set({ selectedToolId: toolId });
  },
  setDashboardLayout: (layout) => {
    get().setViewMode(layout);
  },
  createTool: (input) => {
    return get().addTool(input);
  },
  getToolById: (id) => {
    return get().tools.find((tool) => tool.id === id);
  },
  resetToSeedData: () => {
    persistTools(seedTools);
    set({ tools: seedTools });
  },
}));
