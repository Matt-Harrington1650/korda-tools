import { create } from 'zustand';
import { createSecretVault, createSqliteClient } from '../../../desktop';
import type { CreateToolInput, Tool, UpdateToolInput } from '../../../domain/tool';
import { isTauriRuntime } from '../../../lib/runtime';
import { createToolId } from '../../../lib/ids';
import { upsertCredentialRef } from '../../credentials/credentialService';
import { migrateLegacyToolSecrets } from '../migrations/legacySecretMigration';
import { createToolInputSchema, toolSchema, toolSchemaVersion, updateToolInputSchema } from '../../../schemas/tool';
import { toolRegistrySchema, toolRegistrySchemaVersion } from '../../../schemas/toolRegistry';
import { createStorageEngine, hasAsyncLoad } from '../../../storage/createStorageEngine';
import { migrateTools } from '../../../storage/migrations';
import { STORAGE_KEYS } from '../../../storage/keys';
import { seedTools } from '../seedTools';
import { normalizeToolWithPlugin, normalizeToolsWithPlugins } from '../../../plugins';

const persistence = createStorageEngine({
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
    return normalizeToolsWithPlugins(validatedTools).tools;
  }

  persistTools(seedTools);
  return seedTools;
};

const safeParseJson = (value: string): unknown | null => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const loadRawToolRecordsFromLocalStorage = (): unknown[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.tools);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as { tools?: unknown };
    return Array.isArray(parsed.tools) ? parsed.tools : [];
  } catch {
    return [];
  }
};

type RawToolConfigRow = {
  config_json: string;
};

const loadRawToolRecords = async (): Promise<unknown[]> => {
  if (isTauriRuntime()) {
    try {
      const sqlite = createSqliteClient();
      const rows = await sqlite.select<RawToolConfigRow>('SELECT config_json FROM tools');

      return rows
        .map((row) => safeParseJson(row.config_json))
        .filter((item): item is unknown => item !== null);
    } catch {
      return [];
    }
  }

  return loadRawToolRecordsFromLocalStorage();
};

const runLegacySecretMigration = async (tools: Tool[], setTools: (tools: Tool[]) => void): Promise<void> => {
  if (tools.length === 0) {
    return;
  }

  const rawToolRecords = await loadRawToolRecords();
  if (rawToolRecords.length === 0) {
    return;
  }

  const secretVault = createSecretVault();
  const migrated = await migrateLegacyToolSecrets(tools, rawToolRecords, {
    isTauriRuntime: isTauriRuntime(),
    nowMs: () => Date.now(),
    setSecret: (credentialId, secretValue) => {
      return secretVault.setSecret(credentialId, secretValue);
    },
    upsertCredentialRef,
  });

  if (!migrated.changed) {
    return;
  }

  persistTools(migrated.tools);
  setTools(migrated.tools);
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
  replaceTools: (tools: Tool[]) => void;
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

    const normalized = normalizeToolsWithPlugins(validatedTools);
    if (normalized.changed) {
      persistTools(normalized.tools);
    }

    set({ tools: normalized.tools });

    if (hasAsyncLoad(persistence)) {
      void persistence
        .loadAsync()
        .then((asyncPersisted) => {
          const asyncValidatedTools = validatePersistedTools(asyncPersisted);
          if (!asyncValidatedTools || asyncValidatedTools.length === 0) {
            return;
          }

          const normalizedAsync = normalizeToolsWithPlugins(asyncValidatedTools);
          if (normalizedAsync.changed) {
            persistTools(normalizedAsync.tools);
          }

          set({ tools: normalizedAsync.tools });

          void runLegacySecretMigration(normalizedAsync.tools, (nextTools) => {
            set({ tools: nextTools });
          }).catch(() => {
            // TODO(extension): add telemetry hook for async legacy secret migration failures.
          });
        })
        .catch(() => {
          // TODO(extension): add telemetry hook for async tool hydration failures.
        });
    }

    void runLegacySecretMigration(normalized.tools, (nextTools) => {
      set({ tools: nextTools });
    }).catch(() => {
      // TODO(extension): add telemetry hook for legacy secret migration failures.
    });
  },
  replaceTools: (tools) => {
    const validatedTools = tools
      .map((tool) => toolSchema.safeParse(tool))
      .filter((result): result is { success: true; data: Tool } => result.success)
      .map((result) => result.data);
    const normalized = normalizeToolsWithPlugins(validatedTools).tools;

    persistTools(normalized);
    set({
      tools: normalized,
      selectedToolId: normalized.some((tool) => tool.id === get().selectedToolId) ? get().selectedToolId : undefined,
    });
  },
  addTool: (input) => {
    const parsedInput = createToolInputSchema.parse(input);
    const timestamp = new Date().toISOString();

    const rawTool = toolSchema.parse({
      id: createToolId(),
      version: toolSchemaVersion,
      ...parsedInput,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const { tool } = normalizeToolWithPlugin(rawTool);

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

      const parsedTool = toolSchema.parse({
        ...tool,
        ...parsedInput,
        updatedAt: new Date().toISOString(),
      });
      updatedTool = normalizeToolWithPlugin(parsedTool).tool;

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
