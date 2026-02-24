import { create } from 'zustand';
import type { ToolRunActionType, ToolRunLog, ToolRunRequestSummary, ToolRunResponseSummary } from '../../../domain/log';
import { createToolId } from '../../../lib/ids';
import { toolRunLogHistorySchema, toolRunLogSchema, toolRunLogSchemaVersion } from '../../../schemas/logSchemas';
import { createStorageEngine, hasAsyncLoad } from '../../../storage/createStorageEngine';
import { migrateToolRunLogs } from '../../../storage/migrations';
import { STORAGE_KEYS } from '../../../storage/keys';

const MAX_LOG_ENTRIES = 300;

const persistence = createStorageEngine({
  key: STORAGE_KEYS.toolRunLogs,
  schema: toolRunLogHistorySchema,
  defaultValue: {
    version: toolRunLogSchemaVersion,
    entries: [],
  },
  migrate: migrateToolRunLogs,
});

const persistEntries = (entries: ToolRunLog[]): void => {
  persistence.save({
    version: toolRunLogSchemaVersion,
    entries,
  });
};

const loadInitialEntries = (): ToolRunLog[] => {
  const persisted = persistence.load();
  return persisted.entries;
};

type AppendToolRunLogInput = {
  toolId: string;
  actionType: ToolRunActionType;
  requestSummary: ToolRunRequestSummary;
  responseSummary: ToolRunResponseSummary;
  success: boolean;
  errorDetails: string;
};

type ToolRunLogState = {
  entries: ToolRunLog[];
  appendLog: (input: AppendToolRunLogInput) => ToolRunLog;
  clearLogsForTool: (toolId: string) => void;
  getLogsByToolId: (toolId: string) => ToolRunLog[];
  replaceLogs: (entries: ToolRunLog[]) => void;
};

const initialEntries = loadInitialEntries();

export const useToolRunLogStore = create<ToolRunLogState>((set, get) => ({
  entries: initialEntries,
  appendLog: (input) => {
    const entry: ToolRunLog = {
      id: createToolId(),
      version: toolRunLogSchemaVersion,
      toolId: input.toolId,
      timestamp: new Date().toISOString(),
      actionType: input.actionType,
      requestSummary: input.requestSummary,
      responseSummary: input.responseSummary,
      success: input.success,
      errorDetails: input.errorDetails,
    };

    const nextEntries = [entry, ...get().entries].slice(0, MAX_LOG_ENTRIES);
    persistEntries(nextEntries);
    set({ entries: nextEntries });

    return entry;
  },
  clearLogsForTool: (toolId) => {
    const nextEntries = get().entries.filter((entry) => entry.toolId !== toolId);
    persistEntries(nextEntries);
    set({ entries: nextEntries });
  },
  getLogsByToolId: (toolId) => {
    return get().entries.filter((entry) => entry.toolId === toolId);
  },
  replaceLogs: (entries) => {
    const validatedEntries = entries
      .map((entry) => toolRunLogSchema.safeParse(entry))
      .filter((result): result is { success: true; data: ToolRunLog } => result.success)
      .map((result) => result.data)
      .slice(0, MAX_LOG_ENTRIES);

    persistEntries(validatedEntries);
    set({ entries: validatedEntries });
  },
}));

if (hasAsyncLoad(persistence)) {
  void persistence
    .loadAsync()
    .then((persisted) => {
      useToolRunLogStore.setState({
        entries: persisted.entries,
      });
    })
    .catch(() => {
      // TODO(extension): add telemetry hook for async log hydration failures.
    });
}
