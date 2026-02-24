import { isTauriRuntime } from '../lib/runtime';
import { createLocalStorageEngine, type StorageEngineOptions } from './localStorageEngine';
import type { StorageEngine } from './StorageEngine';
import { createSqliteStorageEngine } from './sqlite/SqliteStorageEngine';

export type AsyncLoadableStorageEngine<T> = StorageEngine<T> & {
  loadAsync?: () => Promise<T>;
};

export type LoadAsyncStorageEngine<T> = StorageEngine<T> & {
  loadAsync: () => Promise<T>;
};

export const hasAsyncLoad = <T>(engine: StorageEngine<T>): engine is LoadAsyncStorageEngine<T> => {
  return typeof (engine as AsyncLoadableStorageEngine<T>).loadAsync === 'function';
};

export const createStorageEngine = <T>(options: StorageEngineOptions<T>): AsyncLoadableStorageEngine<T> => {
  if (isTauriRuntime()) {
    return createSqliteStorageEngine(options);
  }

  return createLocalStorageEngine(options);
};
