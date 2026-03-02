import { AppError, isAppError } from '../../lib/errors';
import { sha256 } from '../crypto/sha256';

interface ArtifactRecord {
  id: string;
  projectId: string;
  sha256: string;
  objectKey: string;
  immutable: boolean;
}

interface DeliverableRecord {
  id: string;
  projectId: string;
  currentVersionNo: number;
  status: 'finalized';
}

interface DeliverableVersionRecord {
  id: string;
  deliverableId: string;
  versionNo: number;
  artifactId: string;
  artifactHash: string;
  parentVersionId: string | null;
}

interface ArtifactRepository {
  getById(artifactId: string): Promise<ArtifactRecord | null>;
}

interface DeliverableRepository {
  createDeliverable(input: {
    deliverableId: string;
    projectId: string;
    createdBy: string;
    createdAtUtc: string;
  }): Promise<DeliverableRecord>;
  getById(deliverableId: string): Promise<DeliverableRecord | null>;
  updateCurrentVersionNo(deliverableId: string, versionNo: number, updatedAtUtc: string): Promise<void>;
  getCurrentVersion(deliverableId: string): Promise<DeliverableVersionRecord | null>;
  insertVersion(input: {
    versionId: string;
    deliverableId: string;
    versionNo: number;
    artifactId: string;
    artifactHash: string;
    parentVersionId: string | null;
    reason: string;
    createdBy: string;
    createdAtUtc: string;
  }): Promise<DeliverableVersionRecord>;
}

interface ArtifactBlobReader {
  getReadonlyByHash(projectId: string, hash: string): Promise<Uint8Array>;
}

interface DeliverableAuditAppender {
  append(event: {
    actorId: string;
    action: 'deliverable.finalized' | 'deliverable.version.created';
    projectId: string;
    deliverableId: string;
    versionId: string;
    artifactId: string;
    artifactHash: string;
    reason: string;
    occurredAtUtc: string;
  }): Promise<void>;
}

interface TransactionRunner {
  runInTransaction<T>(action: () => Promise<T>): Promise<T>;
}

export interface FinalizeDeliverableResult {
  deliverableId: string;
  versionId: string;
  versionNo: number;
  artifactHash: string;
  finalizedAtUtc: string;
}

export interface ArtifactIntegrityResult {
  artifactId: string;
  expectedHash: string;
  computedHash: string;
  valid: boolean;
}

export class DeliverableService {
  private readonly artifacts: ArtifactRepository;
  private readonly deliverables: DeliverableRepository;
  private readonly blobReader: ArtifactBlobReader;
  private readonly audit: DeliverableAuditAppender;
  private readonly tx: TransactionRunner;

  constructor(
    artifacts: ArtifactRepository,
    deliverables: DeliverableRepository,
    blobReader: ArtifactBlobReader,
    audit: DeliverableAuditAppender,
    tx: TransactionRunner,
  ) {
    this.artifacts = artifacts;
    this.deliverables = deliverables;
    this.blobReader = blobReader;
    this.audit = audit;
    this.tx = tx;
  }

  async finalizeDeliverable(
    artifactId: string,
    actorId: string,
    reason: string,
  ): Promise<FinalizeDeliverableResult> {
    assertNonEmpty(reason, 'FINALIZE_REASON_REQUIRED');

    const artifact = await this.requireArtifact(artifactId);
    const integrity = await this.verifyArtifactIntegrity(artifactId);
    if (!integrity.valid) {
      throw new AppError('ARTIFACT_HASH_MISMATCH', 'Artifact integrity check failed during finalization.', {
        artifactId,
        expectedHash: integrity.expectedHash,
        computedHash: integrity.computedHash,
      });
    }

    const now = new Date().toISOString();
    const deliverableId = createId('deliverable');
    const versionId = createId('deliverable-version');

    await this.tx.runInTransaction(async () => {
      await this.deliverables.createDeliverable({
        deliverableId,
        projectId: artifact.projectId,
        createdBy: actorId,
        createdAtUtc: now,
      });

      await this.deliverables.insertVersion({
        versionId,
        deliverableId,
        versionNo: 1,
        artifactId: artifact.id,
        artifactHash: artifact.sha256,
        parentVersionId: null,
        reason,
        createdBy: actorId,
        createdAtUtc: now,
      });

      await this.audit.append({
        actorId,
        action: 'deliverable.finalized',
        projectId: artifact.projectId,
        deliverableId,
        versionId,
        artifactId: artifact.id,
        artifactHash: artifact.sha256,
        reason,
        occurredAtUtc: now,
      });
    });

    return {
      deliverableId,
      versionId,
      versionNo: 1,
      artifactHash: artifact.sha256,
      finalizedAtUtc: now,
    };
  }

  async verifyArtifactIntegrity(artifactId: string): Promise<ArtifactIntegrityResult> {
    const artifact = await this.requireArtifact(artifactId);
    const bytes = await this.blobReader.getReadonlyByHash(artifact.projectId, artifact.sha256);
    const computedHash = await sha256(bytes);

    return {
      artifactId: artifact.id,
      expectedHash: artifact.sha256,
      computedHash,
      valid: computedHash === artifact.sha256,
    };
  }

  async createNewVersion(
    deliverableId: string,
    newArtifactId: string,
    actorId: string,
    reason: string,
  ): Promise<FinalizeDeliverableResult> {
    assertNonEmpty(reason, 'NEW_VERSION_REASON_REQUIRED');

    const deliverable = await this.requireDeliverable(deliverableId);
    const currentVersion = await this.deliverables.getCurrentVersion(deliverableId);
    if (!currentVersion) {
      throw new AppError('DELIVERABLE_CURRENT_VERSION_MISSING', 'Deliverable has no current version.', {
        deliverableId,
      });
    }

    const artifact = await this.requireArtifact(newArtifactId);
    if (artifact.projectId !== deliverable.projectId) {
      throw new AppError('DELIVERABLE_PROJECT_MISMATCH', 'Artifact project does not match deliverable project.', {
        deliverableId,
        artifactId: newArtifactId,
      });
    }

    const integrity = await this.verifyArtifactIntegrity(newArtifactId);
    if (!integrity.valid) {
      throw new AppError('ARTIFACT_HASH_MISMATCH', 'Artifact integrity check failed for new version.', {
        artifactId: newArtifactId,
      });
    }

    if (currentVersion.artifactHash === artifact.sha256) {
      throw new AppError(
        'DELIVERABLE_VERSION_HASH_UNCHANGED',
        'New version must reference a new artifact hash; overwrite is disallowed by design.',
        {
          deliverableId,
          artifactId: newArtifactId,
        },
      );
    }

    const now = new Date().toISOString();
    const nextVersionNo = currentVersion.versionNo + 1;
    const nextVersionId = createId('deliverable-version');

    await this.tx.runInTransaction(async () => {
      await this.deliverables.insertVersion({
        versionId: nextVersionId,
        deliverableId,
        versionNo: nextVersionNo,
        artifactId: artifact.id,
        artifactHash: artifact.sha256,
        parentVersionId: currentVersion.id,
        reason,
        createdBy: actorId,
        createdAtUtc: now,
      });

      await this.deliverables.updateCurrentVersionNo(deliverableId, nextVersionNo, now);

      await this.audit.append({
        actorId,
        action: 'deliverable.version.created',
        projectId: artifact.projectId,
        deliverableId,
        versionId: nextVersionId,
        artifactId: artifact.id,
        artifactHash: artifact.sha256,
        reason,
        occurredAtUtc: now,
      });
    });

    return {
      deliverableId,
      versionId: nextVersionId,
      versionNo: nextVersionNo,
      artifactHash: artifact.sha256,
      finalizedAtUtc: now,
    };
  }

  private async requireArtifact(artifactId: string): Promise<ArtifactRecord> {
    try {
      const artifact = await this.artifacts.getById(artifactId);
      if (!artifact) {
        throw new AppError('ARTIFACT_NOT_FOUND', 'Artifact was not found.', { artifactId });
      }
      if (!artifact.immutable) {
        throw new AppError('ARTIFACT_NOT_IMMUTABLE', 'Only immutable artifacts can back deliverables.', {
          artifactId,
        });
      }

      return artifact;
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw new AppError('ARTIFACT_LOOKUP_FAILED', 'Failed to load artifact.', error);
    }
  }

  private async requireDeliverable(deliverableId: string): Promise<DeliverableRecord> {
    const record = await this.deliverables.getById(deliverableId);
    if (!record) {
      throw new AppError('DELIVERABLE_NOT_FOUND', 'Deliverable was not found.', { deliverableId });
    }

    return record;
  }
}

function assertNonEmpty(value: string, errorCode: string): void {
  if (value.trim().length === 0) {
    throw new AppError(errorCode, 'Reason must be provided.');
  }
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// TODO: Wire concrete repository + audit adapters to SQLite write path.
// TODO: Enforce role-based policy checks before finalize/version creation.