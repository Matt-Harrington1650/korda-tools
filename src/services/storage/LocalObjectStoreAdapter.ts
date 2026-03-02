import { AppError, isAppError } from '../../lib/errors';
import type {
  ObjectStore,
  ObjectStorePutRequest,
  ObjectStorePutResult,
  ProjectContext,
  Sha256Hex,
} from './ObjectStore';
import type { ObjectStorePathResolver } from './ObjectStorePathResolver';

export interface ObjectStoreFsBridge {
  exists(path: string): Promise<boolean>;
  mkdirp(path: string): Promise<void>;
  writeFileAtomic(path: string, bytes: Uint8Array): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
}

export class LocalObjectStoreAdapter implements ObjectStore {
  private readonly fsBridge: ObjectStoreFsBridge;
  private readonly pathResolver: ObjectStorePathResolver;
  private readonly rootPath: string;

  constructor(fsBridge: ObjectStoreFsBridge, pathResolver: ObjectStorePathResolver, rootPath: string) {
    this.fsBridge = fsBridge;
    this.pathResolver = pathResolver;
    this.rootPath = rootPath;
  }

  async putImmutable(request: ObjectStorePutRequest): Promise<ObjectStorePutResult> {
    try {
      const objectPath = this.pathResolver.resolveObjectPath(this.rootPath, request.hash);
      const objectDir = this.pathResolver.resolveShardDirectory(this.rootPath, request.hash);
      const alreadyExists = await this.fsBridge.exists(objectPath);

      if (!alreadyExists) {
        await this.fsBridge.mkdirp(objectDir);
        await this.fsBridge.writeFileAtomic(objectPath, request.bytes);
      }

      return {
        hash: request.hash,
        objectKey: this.pathResolver.toObjectKey(request.hash),
        sizeBytes: request.bytes.byteLength,
        committedAtUtc: new Date().toISOString(),
      };
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }

      throw new AppError('OBJECT_STORE_PUT_FAILED', 'Failed to persist immutable object.', error);
    }
  }

  async getReadonly(context: ProjectContext, hash: Sha256Hex): Promise<Uint8Array> {
    void context;

    try {
      const objectPath = this.pathResolver.resolveObjectPath(this.rootPath, hash);
      const exists = await this.fsBridge.exists(objectPath);

      if (!exists) {
        throw new AppError('OBJECT_NOT_FOUND', 'Object was not found for the provided hash.', {
          hash,
        });
      }

      return this.fsBridge.readFile(objectPath);
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }

      throw new AppError('OBJECT_STORE_READ_FAILED', 'Failed to read immutable object.', error);
    }
  }

  async exists(context: ProjectContext, hash: Sha256Hex): Promise<boolean> {
    void context;

    try {
      const objectPath = this.pathResolver.resolveObjectPath(this.rootPath, hash);
      return this.fsBridge.exists(objectPath);
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }

      throw new AppError('OBJECT_STORE_EXISTS_FAILED', 'Failed to check object existence.', error);
    }
  }
}

// Tauri-backed bridge is provided by createObjectStoreFsBridge().
// Cloud replication should be implemented as a separate ObjectStore adapter without changing this contract.
