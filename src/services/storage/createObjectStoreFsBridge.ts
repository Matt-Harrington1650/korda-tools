import { AppError } from '../../lib/errors';
import { isTauriRuntime } from '../../lib/runtime';
import { tauriInvoke } from '../../lib/tauri';
import type { ObjectStoreFsBridge } from './LocalObjectStoreAdapter';

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
    return tauriInvoke<T>(command, args);
  }
}

export const createObjectStoreFsBridge = (): ObjectStoreFsBridge => {
  if (isTauriRuntime()) {
    return new TauriObjectStoreFsBridge();
  }
  return new InMemoryObjectStoreFsBridge();
};
