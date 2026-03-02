import { AppError, isAppError } from '../../lib/errors';
import { fileIngest } from '../ingestion/fileIngest';
import type {
  ObjectMetadataRecord,
  ObjectStore,
  ObjectStorePutResult,
  ProjectContext,
} from './ObjectStore';

export interface ObjectMetadataWriter {
  writeObjectMetadata(context: ProjectContext, metadata: ObjectMetadataRecord): Promise<void>;
}

export interface ObjectAuditAppender {
  appendObjectWrite(
    context: ProjectContext,
    payload: {
      objectHash: string;
      objectKey: string;
      sizeBytes: number;
      mimeType: string;
      originalName: string;
    },
  ): Promise<void>;
}

export interface ObjectStoreServicePutInput {
  context: ProjectContext;
  bytes: Uint8Array;
  originalName: string;
  mimeType?: string;
  tempPath?: string;
}

export class ObjectStoreService {
  private readonly objectStore: ObjectStore;
  private readonly metadataWriter: ObjectMetadataWriter;
  private readonly auditAppender: ObjectAuditAppender;

  constructor(
    objectStore: ObjectStore,
    metadataWriter: ObjectMetadataWriter,
    auditAppender: ObjectAuditAppender,
  ) {
    this.objectStore = objectStore;
    this.metadataWriter = metadataWriter;
    this.auditAppender = auditAppender;
  }

  async put(input: ObjectStoreServicePutInput): Promise<ObjectStorePutResult> {
    try {
      const ingested = await fileIngest({
        bytes: input.bytes,
        originalName: input.originalName,
        mimeType: input.mimeType,
        tempPath: input.tempPath,
      });

      const stored = await this.objectStore.putImmutable({
        context: input.context,
        hash: ingested.hash,
        bytes: input.bytes,
        mimeType: ingested.mime,
        originalName: ingested.originalName,
      });

      await this.metadataWriter.writeObjectMetadata(input.context, {
        objectHash: stored.hash,
        objectKey: stored.objectKey,
        sizeBytes: stored.sizeBytes,
        mimeType: ingested.mime,
        originalName: ingested.originalName,
        projectId: input.context.projectId,
        createdBy: input.context.actorId,
        createdAtUtc: stored.committedAtUtc,
      });

      await this.auditAppender.appendObjectWrite(input.context, {
        objectHash: stored.hash,
        objectKey: stored.objectKey,
        sizeBytes: stored.sizeBytes,
        mimeType: ingested.mime,
        originalName: ingested.originalName,
      });

      return stored;
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }

      throw new AppError('OBJECT_STORE_SERVICE_PUT_FAILED', 'ObjectStoreService.put failed.', error);
    }
  }
}

// TODO: Wrap metadata + audit append in a transactional unit where supported.
// TODO: Add policy enforcer dependency for project boundary and external egress checks.
