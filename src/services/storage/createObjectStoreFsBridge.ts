import { AppError } from '../../lib/errors';
import { isTauriRuntime } from '../../lib/runtime';
import type { ObjectStoreFsBridge } from './LocalObjectStoreAdapter';

type InvokeFunction = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

const inMemoryFiles = new Map<string, Uint8Array>();
const inMemoryDirectories = new Set<string>();

const normalizePath = (path: string): string => {
  const normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  if (normalized.length === 0) {
    throw new AppError('OBJECT_STORE_PATH_INVALID', 'Object store path cannot be empty.');
  }
  return normalized;
};

class InMemoryObjectStoreFsBridge implements ObjectStoreFsBridge {
  async exists(path: string): Promise<boolean> {
    const normalized = normalizePath(path);
    return inMemoryFiles.has(normalized) || inMemoryDirectories.has(normalized);
  }

  async mkdirp(path: string): Promise<void> {
    inMemoryDirectories.add(normalizePath(path));
  }

  async writeFileAtomic(path: string, bytes: Uint8Array): Promise<void> {
    inMemoryFiles.set(normalizePath(path), Uint8Array.from(bytes));
  }

  async readFile(path: string): Promise<Uint8Array> {
    const normalized = normalizePath(path);
    const value = inMemoryFiles.get(normalized);
    if (!value) {
      throw new AppError('OBJECT_NOT_FOUND', 'Object was not found for the provided path.', {
        path: normalized,
      });
    }
    return Uint8Array.from(value);
  }
}

class TauriObjectStoreFsBridge implements ObjectStoreFsBridge {
  private invokePromise: Promise<InvokeFunction> | null = null;

  async exists(path: string): Promise<boolean> {
    return this.invoke<boolean>('object_store_exists', { path });
  }

  async mkdirp(path: string): Promise<void> {
    await this.invoke<void>('object_store_mkdirp', { path });
  }

  async writeFileAtomic(path: string, bytes: Uint8Array): Promise<void> {
    await this.invoke<void>('object_store_write_file_atomic', {
      path,
      bytes: Array.from(bytes),
    });
  }

  async readFile(path: string): Promise<Uint8Array> {
    const output = await this.invoke<number[]>('object_store_read_file', { path });
    return Uint8Array.from(output);
  }

  private async invoke<T>(command: string, args: Record<string, unknown>): Promise<T> {
    const invokeFn = await this.resolveInvoke();
    return invokeFn<T>(command, args);
  }

  private async resolveInvoke(): Promise<InvokeFunction> {
    if (!this.invokePromise) {
      this.invokePromise = (async () => {
        const tauriCore = await import('@tauri-apps/api/core');
        return tauriCore.invoke as InvokeFunction;
      })();
    }
    return this.invokePromise;
  }
}

export const createObjectStoreFsBridge = (): ObjectStoreFsBridge => {
  if (isTauriRuntime()) {
    return new TauriObjectStoreFsBridge();
  }
  return new InMemoryObjectStoreFsBridge();
};
