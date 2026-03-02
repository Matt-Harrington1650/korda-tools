import { AppError, isAppError } from '../../lib/errors';
import { sha256 } from '../crypto/sha256';
import type { PolicyEnforcer } from '../policy/PolicyEnforcer';
import type { GovernanceScope, SensitivityLevel } from '../policy/types';

interface ArtifactRecord {
  id: string;
  projectId: string;
  sha256: string;
  objectKey: string;
  artifactType: string;
  sensitivityLevel: SensitivityLevel;
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
  getByIdForProject(projectId: string, artifactId: string): Promise<ArtifactRecord | null>;
}

interface DeliverableRepository {
  createDeliverable(input: {
    deliverableId: string;
    projectId: string;
    createdBy: string;
    createdAtUtc: string;
  }): Promise<DeliverableRecord>;
  getByIdForProject(projectId: string, deliverableId: string): Promise<DeliverableRecord | null>;
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
  private readonly policyEnforcer: PolicyEnforcer;

  constructor(
    artifacts: ArtifactRepository,
    deliverables: DeliverableRepository,
    blobReader: ArtifactBlobReader,
    audit: DeliverableAuditAppender,
    tx: TransactionRunner,
    policyEnforcer: PolicyEnforcer,
  ) {
    this.artifacts = artifacts;
    this.deliverables = deliverables;
    this.blobReader = blobReader;
    this.audit = audit;
    this.tx = tx;
    this.policyEnforcer = policyEnforcer;
  }

  async finalizeDeliverable(
    scope: GovernanceScope,
    artifactId: string,
    reason: string,
  ): Promise<FinalizeDeliverableResult> {
    assertNonEmpty(reason, 'FINALIZE_REASON_REQUIRED');

    const artifact = await this.requireArtifact(scope, artifactId);
    await this.assertPolicyDecision(
      await this.policyEnforcer.authorizeDeliverableFinalize({
        scope,
        artifact: toPolicyArtifact(artifact),
      }),
    );
    const integrity = await this.computeArtifactIntegrity(artifact);
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
        createdBy: scope.actorId,
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
        createdBy: scope.actorId,
        createdAtUtc: now,
      });

      await this.audit.append({
        actorId: scope.actorId,
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

  async verifyArtifactIntegrity(scope: GovernanceScope, artifactId: string): Promise<ArtifactIntegrityResult> {
    const artifact = await this.requireArtifact(scope, artifactId);
    await this.assertPolicyDecision(
      await this.policyEnforcer.authorizeIntegrityCheck({
        scope,
        artifact: toPolicyArtifact(artifact),
      }),
    );
    return this.computeArtifactIntegrity(artifact);
  }

  async createNewVersion(
    scope: GovernanceScope,
    deliverableId: string,
    newArtifactId: string,
    reason: string,
  ): Promise<FinalizeDeliverableResult> {
    assertNonEmpty(reason, 'NEW_VERSION_REASON_REQUIRED');

    const deliverable = await this.requireDeliverable(scope, deliverableId);
    const currentVersion = await this.deliverables.getCurrentVersion(deliverableId);
    if (!currentVersion) {
      throw new AppError('DELIVERABLE_CURRENT_VERSION_MISSING', 'Deliverable has no current version.', {
        deliverableId,
      });
    }

    const artifact = await this.requireArtifact(scope, newArtifactId);
    if (artifact.projectId !== deliverable.projectId) {
      throw new AppError('DELIVERABLE_SCOPE_MISMATCH', 'Artifact scope does not match deliverable scope.', {
        deliverableId,
        artifactId: newArtifactId,
        scopeProjectId: scope.projectId,
      });
    }

    await this.assertPolicyDecision(
      await this.policyEnforcer.authorizeDeliverableVersion({
        scope,
        deliverable: {
          id: deliverable.id,
          projectId: deliverable.projectId,
          status: deliverable.status,
        },
        artifact: toPolicyArtifact(artifact),
      }),
    );

    const integrity = await this.computeArtifactIntegrity(artifact);
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
        createdBy: scope.actorId,
        createdAtUtc: now,
      });

      await this.deliverables.updateCurrentVersionNo(deliverableId, nextVersionNo, now);

      await this.audit.append({
        actorId: scope.actorId,
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

  private async computeArtifactIntegrity(artifact: ArtifactRecord): Promise<ArtifactIntegrityResult> {
    const bytes = await this.blobReader.getReadonlyByHash(artifact.projectId, artifact.sha256);
    const computedHash = await sha256(bytes);

    return {
      artifactId: artifact.id,
      expectedHash: artifact.sha256,
      computedHash,
      valid: computedHash === artifact.sha256,
    };
  }

  private async requireArtifact(scope: GovernanceScope, artifactId: string): Promise<ArtifactRecord> {
    try {
      assertScope(scope);

      const artifact = await this.artifacts.getByIdForProject(scope.projectId, artifactId);
      if (!artifact) {
        throw new AppError('PROJECT_SCOPE_VIOLATION', 'Artifact is not visible in the active project scope.', {
          artifactId,
          scopeProjectId: scope.projectId,
        });
      }
      if (!artifact.immutable) {
        throw new AppError('ARTIFACT_NOT_IMMUTABLE', 'Only immutable artifacts can back deliverables.', {
          artifactId,
        });
      }
      if (artifact.artifactType.toLowerCase() === 'ai_output') {
        throw new AppError(
          'ARTIFACT_AUTHORITY_REJECTED',
          'AI Output is never authoritative and cannot be finalized as record.',
          { artifactId },
        );
      }

      return artifact;
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw new AppError('ARTIFACT_LOOKUP_FAILED', 'Failed to load artifact.', error);
    }
  }

  private async requireDeliverable(scope: GovernanceScope, deliverableId: string): Promise<DeliverableRecord> {
    assertScope(scope);
    const record = await this.deliverables.getByIdForProject(scope.projectId, deliverableId);
    if (!record) {
      throw new AppError('DELIVERABLE_SCOPE_MISMATCH', 'Deliverable is not visible in the active project scope.', {
        deliverableId,
        scopeProjectId: scope.projectId,
      });
    }

    return record;
  }

  private async assertPolicyDecision(decision: {
    decision: 'allowed' | 'blocked' | 'override';
    code: string;
    reason: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (decision.decision === 'blocked') {
      throw new AppError(decision.code, decision.reason, decision.metadata);
    }
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

function assertScope(scope: GovernanceScope): void {
  if (!scope.workspaceId.trim() || !scope.projectId.trim() || !scope.actorId.trim()) {
    throw new AppError('SCOPE_REQUIRED', 'workspaceId, projectId, and actorId are required.');
  }
}

function toPolicyArtifact(artifact: ArtifactRecord): {
  id: string;
  projectId: string;
  artifactType: string;
  sensitivityLevel: SensitivityLevel;
} {
  return {
    id: artifact.id,
    projectId: artifact.projectId,
    artifactType: artifact.artifactType,
    sensitivityLevel: artifact.sensitivityLevel,
  };
}
