import type { ZodType } from 'zod';
import type { StorageEngine } from './StorageEngine';

export type StorageEngineOptions<T> = {
  key: string;
  schema: ZodType<T>;
  defaultValue: T;
  migrate?: (raw: unknown) => unknown;
};

type LocalStorageEngineOptions<T> = StorageEngineOptions<T> & {
  storage?: Storage;
};

const getDefaultStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
};

const cloneDefaultValue = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const safeParseJson = (raw: string): unknown | null => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const createLocalStorageEngine = <T>({
  key,
  schema,
  defaultValue,
  migrate = (raw) => raw,
  storage = getDefaultStorage() ?? undefined,
}: LocalStorageEngineOptions<T>): StorageEngine<T> => ({
  load: () => {
    if (!storage) {
      return cloneDefaultValue(defaultValue);
    }

    const rawValue = storage.getItem(key);
    if (!rawValue) {
      return cloneDefaultValue(defaultValue);
    }

    const parsed = safeParseJson(rawValue);
    if (parsed === null) {
      return cloneDefaultValue(defaultValue);
    }

    const migrated = migrate(parsed);
    const result = schema.safeParse(migrated);
    if (!result.success) {
      return cloneDefaultValue(defaultValue);
    }

    return result.data;
  },
  save: (value) => {
    if (!storage) {
      return;
    }

    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      // TODO(extension): add centralized logging/telemetry for persistence failures.
    }
  },
  clear: () => {
    if (!storage) {
      return;
    }

    storage.removeItem(key);
  },
});
