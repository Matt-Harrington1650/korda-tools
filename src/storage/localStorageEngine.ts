import type { ZodType } from 'zod';
import { createLocalStoragePersistence } from './localStoragePersistence';
import type { StorageEngine } from './StorageEngine';

type LocalStorageEngineOptions<T> = {
  key: string;
  schema: ZodType<T>;
  storage?: Storage;
};

export const createLocalStorageEngine = <T>(options: LocalStorageEngineOptions<T>): StorageEngine<T> => {
  return createLocalStoragePersistence(options);
};
