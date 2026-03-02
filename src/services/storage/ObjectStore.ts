import { AppError } from '../../lib/errors';

export type Sha256Hex = string;

export interface ProjectContext {
  workspaceId: string;
  projectId: string;
  actorId: string;
}

export interface ObjectStorePutRequest {
  context: ProjectContext;
  hash: Sha256Hex;
  bytes: Uint8Array;
  mimeType: string;
  originalName: string;
}

export interface ObjectStorePutResult {
  hash: Sha256Hex;
  objectKey: string;
  sizeBytes: number;
  committedAtUtc: string;
}

export interface ObjectMetadataRecord {
  objectHash: Sha256Hex;
  objectKey: string;
  sizeBytes: number;
  mimeType: string;
  originalName: string;
  projectId: string;
  createdBy: string;
  createdAtUtc: string;
}

export interface ObjectStore {
  putImmutable(request: ObjectStorePutRequest): Promise<ObjectStorePutResult>;
  getReadonly(context: ProjectContext, hash: Sha256Hex): Promise<Uint8Array>;
  exists(context: ProjectContext, hash: Sha256Hex): Promise<boolean>;
}

export const isNotFoundError = (error: unknown): boolean => {
  return error instanceof AppError && error.code === 'OBJECT_NOT_FOUND';
};