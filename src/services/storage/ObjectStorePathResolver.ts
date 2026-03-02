import { AppError } from '../../lib/errors';
import type { Sha256Hex } from './ObjectStore';

const SHA256_REGEX = /^[a-f0-9]{64}$/;

export interface ObjectStorePathResolver {
  toObjectKey(hash: Sha256Hex): string;
  resolveObjectPath(rootPath: string, hash: Sha256Hex): string;
  resolveShardDirectory(rootPath: string, hash: Sha256Hex): string;
}

export class DefaultObjectStorePathResolver implements ObjectStorePathResolver {
  toObjectKey(hash: Sha256Hex): string {
    validateHash(hash);
    const shard = hash.slice(0, 2);
    return `/objects/${shard}/${hash}`;
  }

  resolveObjectPath(rootPath: string, hash: Sha256Hex): string {
    const normalizedRoot = normalizeRoot(rootPath);
    return `${normalizedRoot}${this.toObjectKey(hash)}`;
  }

  resolveShardDirectory(rootPath: string, hash: Sha256Hex): string {
    validateHash(hash);
    const normalizedRoot = normalizeRoot(rootPath);
    const shard = hash.slice(0, 2);
    return `${normalizedRoot}/objects/${shard}`;
  }
}

const validateHash = (hash: Sha256Hex): void => {
  if (!SHA256_REGEX.test(hash)) {
    throw new AppError('INVALID_SHA256', 'Expected lowercase 64-character sha256 hex.', { hash });
  }
};

const normalizeRoot = (rootPath: string): string => {
  const trimmed = rootPath.replace(/[\\/]+$/, '');
  if (trimmed.length === 0) {
    throw new AppError('INVALID_OBJECT_ROOT', 'Object store root path cannot be empty.');
  }

  return trimmed;
};