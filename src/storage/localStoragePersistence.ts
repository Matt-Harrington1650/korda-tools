import type { ZodType } from 'zod';
import type { PersistenceAdapter } from './persistence';

type LocalStoragePersistenceOptions<T> = {
  key: string;
  schema: ZodType<T>;
  storage?: Storage;
};

const getDefaultStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
};

export const createLocalStoragePersistence = <T>({
  key,
  schema,
  storage = getDefaultStorage() ?? undefined,
}: LocalStoragePersistenceOptions<T>): PersistenceAdapter<T> => ({
  load: () => {
    if (!storage) {
      return null;
    }

    try {
      const rawValue = storage.getItem(key);
      if (!rawValue) {
        return null;
      }

      const parsed = JSON.parse(rawValue);
      const result = schema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
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
