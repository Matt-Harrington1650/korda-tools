import { createSqliteClient, type SqliteClient } from '../../desktop';
import { AppError, isAppError } from '../../lib/errors';
import { isTauriRuntime } from '../../lib/runtime';
import { AuditService, type AuditRecord } from '../../services/audit/AuditService';
import {
  DeliverableService,
  type ArtifactIntegrityResult,
  type FinalizeDeliverableResult,
} from '../../services/deliverables/DeliverableService';
import { FailClosedPolicyEnforcer } from '../../services/policy/FailClosedPolicyEnforcer';
import type {
  GovernanceScope,
  PolicyRepository,
  ProjectRole,
  SensitivityLevel,
} from '../../services/policy/types';
import { LocalObjectStoreAdapter } from '../../services/storage/LocalObjectStoreAdapter';
import { DefaultObjectStorePathResolver } from '../../services/storage/ObjectStorePathResolver';
import type { ObjectStore, ProjectContext } from '../../services/storage/ObjectStore';
import {
  ObjectStoreService,
  type ObjectMetadataWriter,
  type ObjectAuditAppender,
} from '../../services/storage/ObjectStoreService';
import { createObjectStoreFsBridge } from '../../services/storage/createObjectStoreFsBridge';

export type { GovernanceScope, SensitivityLevel };
export type { ProjectRole };

export interface IngestArtifactInput {
  scope: GovernanceScope;
  bytes: Uint8Array;
  originalName: string;
  mimeType?: string;
  artifactType: string;
  discipline: string;
  status: string;
  sensitivityLevel: SensitivityLevel;
}

export interface ArtifactSummary {
  id: string;
  projectId: string;
  artifactType: string;
  discipline: string;
  status: string;
  sensitivityLevel: SensitivityLevel;
  sha256: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  immutable: boolean;
  createdBy: string;
  createdAtUtc: string;
  referencedVersionCount: number;
}

export interface DeliverableSummary {
  id: string;
  projectId: string;
  status: 'finalized';
  currentVersionNo: number;
  updatedAtUtc: string;
  currentVersionId: string | null;
  currentArtifactId: string | null;
  currentArtifactHash: string | null;
}

export interface DeliverableVersionSummary {
  id: string;
  deliverableId: string;
  versionNo: number;
  artifactId: string;
  artifactHash: string;
  parentVersionId: string | null;
  changeReason: string;
  createdBy: string;
  createdAtUtc: string;
}

export interface ProjectRoleBindingSummary {
  workspaceId: string;
  projectId: string;
  actorId: string;
  role: ProjectRole;
  grantedBy: string;
  grantedAtUtc: string;
  revokedAtUtc: string | null;
}

export interface PolicyOverrideSummary {
  id: string;
  workspaceId: string;
  projectId: string;
  actorId: string;
  providerId: string;
  sensitivityLevel: SensitivityLevel;
  reason: string;
  approvedBy: string;
  expiresAtUtc: string | null;
  createdAtUtc: string;
  revokedAtUtc: string | null;
}

type ArtifactRow = Omit<ArtifactSummary, 'referencedVersionCount'>;

type DeliverableRow = {
  id: string;
  projectId: string;
  currentVersionNo: number;
  status: 'finalized';
  createdBy: string;
  createdAtUtc: string;
  updatedAtUtc: string;
};

type DeliverableVersionRow = DeliverableVersionSummary;

type ProjectRoleBindingRow = {
  workspaceId: string;
  projectId: string;
  actorId: string;
  role: ProjectRole;
  grantedBy: string;
  grantedAtUtc: string;
  revokedAtUtc: string | null;
};

type PolicyOverrideRow = {
  id: string;
  workspaceId: string;
  projectId: string;
  actorId: string;
  providerId: string;
  sensitivityLevel: SensitivityLevel;
  reason: string;
  approvedBy: string;
  expiresAtUtc: string | null;
  createdAtUtc: string;
  revokedAtUtc: string | null;
};

type InMemoryState = {
  artifacts: ArtifactRow[];
  deliverables: DeliverableRow[];
  deliverableVersions: DeliverableVersionRow[];
  auditRecords: AuditRecord[];
  projectRoleBindings: ProjectRoleBindingRow[];
  policyOverrides: PolicyOverrideRow[];
};

const DEFAULT_OBJECT_STORE_ROOT = 'korda-object-store';

const inMemoryState: InMemoryState = {
  artifacts: [],
  deliverables: [],
  deliverableVersions: [],
  auditRecords: [],
  projectRoleBindings: [],
  policyOverrides: [],
};

export class RecordsGovernanceService {
  private readonly sqlite: SqliteClient;
  private readonly tauriRuntime: boolean;
  private readonly objectStore: ObjectStore;
  private readonly objectStoreService: ObjectStoreService;
  private readonly deliverableService: DeliverableService;
  private readonly projectWorkspaceMap = new Map<string, string>();
  private transactionDepth = 0;

  constructor() {
    this.sqlite = createSqliteClient();
    this.tauriRuntime = isTauriRuntime();
    this.objectStore = new LocalObjectStoreAdapter(
      createObjectStoreFsBridge(),
      new DefaultObjectStorePathResolver(),
      DEFAULT_OBJECT_STORE_ROOT,
    );
    const policyRepository: PolicyRepository = {
      hasProjectRole: async (projectId, actorId, roles) =>
        this.hasProjectRoleBinding(projectId, actorId, roles),
      hasExternalAiOverride: async (input) => this.hasExternalAiOverride(input),
    };
    const policyEnforcer = new FailClosedPolicyEnforcer(policyRepository);

    const metadataWriter: ObjectMetadataWriter = {
      writeObjectMetadata: async (context, metadata) => {
        await this.insertArtifactFromMetadata(context, metadata);
      },
    };

    const objectAuditAppender: ObjectAuditAppender = {
      appendObjectWrite: async (context, payload) => {
        await this.appendAudit(context, {
          actorId: context.actorId,
          action: 'artifact.ingested',
          entityType: 'artifact',
          entityId: payload.objectHash,
          metadata: payload,
        });
      },
    };

    this.objectStoreService = new ObjectStoreService(
      this.objectStore,
      metadataWriter,
      objectAuditAppender,
      policyEnforcer,
      {
        run: async <T>(action: () => Promise<T>): Promise<T> => this.runInTransaction(action),
      },
    );

    this.deliverableService = new DeliverableService(
      {
        getByIdForProject: async (projectId, artifactId) =>
          this.getArtifactForDeliverable(projectId, artifactId),
      },
      {
        createDeliverable: async (input) => this.createDeliverableRow(input),
        getByIdForProject: async (projectId, deliverableId) =>
          this.getDeliverableRow(projectId, deliverableId),
        updateCurrentVersionNo: async (deliverableId, versionNo, updatedAtUtc) =>
          this.updateDeliverableCurrentVersion(deliverableId, versionNo, updatedAtUtc),
        getCurrentVersion: async (deliverableId) => this.getCurrentDeliverableVersion(deliverableId),
        insertVersion: async (input) => this.insertDeliverableVersionRow(input),
      },
      {
        getReadonlyByHash: async (projectId, hash) => {
          await this.requireArtifactByProjectAndHash(projectId, hash);
          return this.objectStore.getReadonly(
            {
              workspaceId: 'system',
              projectId,
              actorId: 'system',
            },
            hash,
          );
        },
      },
      {
        append: async (event) => {
          const workspaceId = this.resolveWorkspaceId(event.projectId);
          await this.appendAudit(
            {
              workspaceId,
              projectId: event.projectId,
              actorId: event.actorId,
            },
            {
              actorId: event.actorId,
              action: event.action,
              entityType: 'deliverable',
              entityId: event.deliverableId,
              metadata: event,
              eventTsUtc: event.occurredAtUtc,
            },
          );
        },
      },
      {
        runInTransaction: async <T>(action: () => Promise<T>): Promise<T> => this.runInTransaction(action),
      },
      policyEnforcer,
    );
  }

  async ingestArtifact(input: IngestArtifactInput): Promise<ArtifactSummary> {
    validateScope(input.scope);
    await this.ensureScope(input.scope);

    try {
      const context = toProjectContext(input.scope);
      const stored = await this.objectStoreService.put({
        context,
        bytes: input.bytes,
        originalName: input.originalName,
        mimeType: input.mimeType,
        artifactType: input.artifactType,
        discipline: input.discipline,
        status: input.status,
        sensitivityLevel: input.sensitivityLevel,
      });

      const row = await this.getArtifactByProjectAndHash(input.scope.projectId, stored.hash);
      if (!row) {
        throw new AppError('ARTIFACT_POST_INGEST_MISSING', 'Artifact metadata row was not persisted.');
      }

      const referencedVersionCount = await this.countArtifactVersions(row.id);
      return mapArtifactRow(row, referencedVersionCount);
    } catch (error) {
      await this.tryAppendPolicyDeniedAudit(input.scope, 'artifact.ingest', error);
      throw error;
    }
  }

  async listArtifacts(scope: GovernanceScope): Promise<ArtifactSummary[]> {
    validateScope(scope);
    await this.ensureScope(scope);
    const rows = await this.listArtifactRows(scope.projectId);
    const counts = await this.listArtifactVersionCounts(scope.projectId);
    return rows.map((row) => mapArtifactRow(row, counts.get(row.id) ?? 0));
  }

  async listDeliverables(scope: GovernanceScope): Promise<DeliverableSummary[]> {
    validateScope(scope);
    await this.ensureScope(scope);

    if (!this.tauriRuntime) {
      return inMemoryState.deliverables
        .filter((row) => row.projectId === scope.projectId)
        .sort((left, right) => right.updatedAtUtc.localeCompare(left.updatedAtUtc))
        .map((row) => {
          const currentVersion =
            inMemoryState.deliverableVersions
              .filter((version) => version.deliverableId === row.id)
              .sort((left, right) => right.versionNo - left.versionNo)[0] ?? null;

          return {
            id: row.id,
            projectId: row.projectId,
            status: row.status,
            currentVersionNo: row.currentVersionNo,
            updatedAtUtc: row.updatedAtUtc,
            currentVersionId: currentVersion?.id ?? null,
            currentArtifactId: currentVersion?.artifactId ?? null,
            currentArtifactHash: currentVersion?.artifactHash ?? null,
          };
        });
    }

    const rows = await this.sqlite.select<{
      id: string;
      project_id: string;
      status: 'finalized';
      current_version_no: number;
      updated_at_utc: string;
      version_id: string | null;
      artifact_id: string | null;
      artifact_hash: string | null;
    }>(
      `
      SELECT
        d.id,
        d.project_id,
        d.status,
        d.current_version_no,
        d.updated_at_utc,
        dv.id AS version_id,
        dv.artifact_id AS artifact_id,
        dv.artifact_hash AS artifact_hash
      FROM deliverables d
      LEFT JOIN deliverable_versions dv
        ON dv.deliverable_id = d.id
       AND dv.version_no = d.current_version_no
      WHERE d.project_id = ?
      ORDER BY d.updated_at_utc DESC
      `,
      [scope.projectId],
    );

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      status: row.status,
      currentVersionNo: Number(row.current_version_no),
      updatedAtUtc: row.updated_at_utc,
      currentVersionId: row.version_id,
      currentArtifactId: row.artifact_id,
      currentArtifactHash: row.artifact_hash,
    }));
  }

  async listDeliverableVersions(scope: GovernanceScope, deliverableId: string): Promise<DeliverableVersionSummary[]> {
    validateScope(scope);
    await this.ensureScope(scope);
    const deliverable = await this.getDeliverableRow(scope.projectId, deliverableId);
    if (!deliverable) {
      throw new AppError('DELIVERABLE_SCOPE_MISMATCH', 'Deliverable is not visible in the active project scope.', {
        deliverableId,
        scopeProjectId: scope.projectId,
      });
    }

    if (!this.tauriRuntime) {
      return inMemoryState.deliverableVersions
        .filter((row) => row.deliverableId === deliverableId)
        .sort((left, right) => right.versionNo - left.versionNo);
    }

    const rows = await this.sqlite.select<{
      id: string;
      deliverable_id: string;
      version_no: number;
      artifact_id: string;
      artifact_hash: string;
      parent_version_id: string | null;
      change_reason: string;
      created_by: string;
      created_at_utc: string;
    }>(
      `
      SELECT
        id,
        deliverable_id,
        version_no,
        artifact_id,
        artifact_hash,
        parent_version_id,
        change_reason,
        created_by,
        created_at_utc
      FROM deliverable_versions
      WHERE deliverable_id = ?
      ORDER BY version_no DESC
      `,
      [deliverableId],
    );

    return rows.map((row) => ({
      id: row.id,
      deliverableId: row.deliverable_id,
      versionNo: Number(row.version_no),
      artifactId: row.artifact_id,
      artifactHash: row.artifact_hash,
      parentVersionId: row.parent_version_id,
      changeReason: row.change_reason,
      createdBy: row.created_by,
      createdAtUtc: row.created_at_utc,
    }));
  }

  async listAuditEvents(scope: GovernanceScope, limit = 50): Promise<AuditRecord[]> {
    validateScope(scope);
    await this.ensureScope(scope);

    if (!this.tauriRuntime) {
      return inMemoryState.auditRecords
        .filter((row) => row.workspaceId === scope.workspaceId && row.projectId === scope.projectId)
        .slice(-Math.max(1, limit))
        .reverse();
    }

    const rows = await this.sqlite.select<{
      id: string;
      workspace_id: string;
      project_id: string;
      actor_id: string;
      action: string;
      entity_type: string;
      entity_id: string;
      event_ts_utc: string;
      prev_hash: string | null;
      event_hash: string;
      canonical_payload_json: string;
      hash_algorithm: 'sha256';
      chain_version: number;
    }>(
      `
      SELECT
        id,
        workspace_id,
        project_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        event_ts_utc,
        prev_hash,
        event_hash,
        canonical_payload_json,
        hash_algorithm,
        chain_version
      FROM audit_log
      WHERE workspace_id = ? AND project_id = ?
      ORDER BY event_ts_utc DESC, id DESC
      LIMIT ?
      `,
      [scope.workspaceId, scope.projectId, Math.max(1, limit)],
    );

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      eventTsUtc: row.event_ts_utc,
      prevHash: row.prev_hash,
      eventHash: row.event_hash,
      canonicalPayloadJson: row.canonical_payload_json,
      hashAlgorithm: row.hash_algorithm,
      chainVersion: Number(row.chain_version),
    }));
  }

  async finalizeArtifact(
    scope: GovernanceScope,
    artifactId: string,
    reason: string,
  ): Promise<FinalizeDeliverableResult> {
    validateScope(scope);
    await this.ensureScope(scope);
    try {
      return await this.deliverableService.finalizeDeliverable(scope, artifactId, reason);
    } catch (error) {
      await this.tryAppendPolicyDeniedAudit(scope, 'deliverable.finalize', error);
      throw error;
    }
  }

  async createDeliverableVersion(
    scope: GovernanceScope,
    deliverableId: string,
    artifactId: string,
    reason: string,
  ): Promise<FinalizeDeliverableResult> {
    validateScope(scope);
    await this.ensureScope(scope);
    try {
      return await this.deliverableService.createNewVersion(scope, deliverableId, artifactId, reason);
    } catch (error) {
      await this.tryAppendPolicyDeniedAudit(scope, 'deliverable.version', error);
      throw error;
    }
  }

  async verifyArtifactIntegrity(scope: GovernanceScope, artifactId: string): Promise<ArtifactIntegrityResult> {
    validateScope(scope);
    await this.ensureScope(scope);
    try {
      return await this.deliverableService.verifyArtifactIntegrity(scope, artifactId);
    } catch (error) {
      await this.tryAppendPolicyDeniedAudit(scope, 'artifact.integrity', error);
      throw error;
    }
  }

  async listProjectRoleBindings(scope: GovernanceScope): Promise<ProjectRoleBindingSummary[]> {
    validateScope(scope);
    await this.ensureScope(scope);

    if (!this.tauriRuntime) {
      return inMemoryState.projectRoleBindings
        .filter((row) => row.workspaceId === scope.workspaceId && row.projectId === scope.projectId)
        .slice()
        .sort((left, right) => right.grantedAtUtc.localeCompare(left.grantedAtUtc));
    }

    const rows = await this.sqlite.select<{
      workspace_id: string;
      project_id: string;
      actor_id: string;
      role: ProjectRole;
      granted_by: string;
      granted_at_utc: string;
      revoked_at_utc: string | null;
    }>(
      `
      SELECT
        workspace_id,
        project_id,
        actor_id,
        role,
        granted_by,
        granted_at_utc,
        revoked_at_utc
      FROM project_role_bindings
      WHERE workspace_id = ? AND project_id = ?
      ORDER BY granted_at_utc DESC, actor_id ASC, role ASC
      `,
      [scope.workspaceId, scope.projectId],
    );

    return rows.map((row) => ({
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      actorId: row.actor_id,
      role: row.role,
      grantedBy: row.granted_by,
      grantedAtUtc: row.granted_at_utc,
      revokedAtUtc: row.revoked_at_utc,
    }));
  }

  async listPolicyOverrides(scope: GovernanceScope): Promise<PolicyOverrideSummary[]> {
    validateScope(scope);
    await this.ensureScope(scope);

    if (!this.tauriRuntime) {
      return inMemoryState.policyOverrides
        .filter((row) => row.workspaceId === scope.workspaceId && row.projectId === scope.projectId)
        .slice()
        .sort((left, right) => right.createdAtUtc.localeCompare(left.createdAtUtc));
    }

    const rows = await this.sqlite.select<{
      id: string;
      workspace_id: string;
      project_id: string;
      actor_id: string;
      provider_id: string;
      sensitivity_level: SensitivityLevel;
      reason: string;
      approved_by: string;
      expires_at_utc: string | null;
      created_at_utc: string;
      revoked_at_utc: string | null;
    }>(
      `
      SELECT
        id,
        workspace_id,
        project_id,
        actor_id,
        provider_id,
        sensitivity_level,
        reason,
        approved_by,
        expires_at_utc,
        created_at_utc,
        revoked_at_utc
      FROM policy_overrides
      WHERE workspace_id = ? AND project_id = ?
      ORDER BY created_at_utc DESC
      `,
      [scope.workspaceId, scope.projectId],
    );

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      actorId: row.actor_id,
      providerId: row.provider_id,
      sensitivityLevel: row.sensitivity_level,
      reason: row.reason,
      approvedBy: row.approved_by,
      expiresAtUtc: row.expires_at_utc,
      createdAtUtc: row.created_at_utc,
      revokedAtUtc: row.revoked_at_utc,
    }));
  }

  async grantProjectRole(
    scope: GovernanceScope,
    actorId: string,
    role: ProjectRole,
    grantedBy = scope.actorId,
  ): Promise<void> {
    validateScope(scope);
    if (!actorId.trim()) {
      throw new AppError('ACTOR_REQUIRED', 'actorId is required.');
    }
    await this.ensureScope(scope);

    const normalizedActorId = actorId.trim();
    const normalizedGrantedBy = grantedBy.trim() || scope.actorId;
    const now = new Date().toISOString();

    await this.runInTransaction(async () => {
      await this.upsertProjectRoleBinding({
        workspaceId: scope.workspaceId,
        projectId: scope.projectId,
        actorId: normalizedActorId,
        role,
        grantedBy: normalizedGrantedBy,
        grantedAtUtc: now,
      });

      await this.appendAudit(scope, {
        actorId: scope.actorId,
        action: 'policy.role.granted',
        entityType: 'policy_role_binding',
        entityId: `${normalizedActorId}:${role}`,
        metadata: {
          workspaceId: scope.workspaceId,
          projectId: scope.projectId,
          actorId: normalizedActorId,
          role,
          grantedBy: normalizedGrantedBy,
          grantedAtUtc: now,
        },
        eventTsUtc: now,
      });
    });
  }

  async grantExternalAiOverride(input: {
    scope: GovernanceScope;
    actorId: string;
    providerId: string;
    sensitivityLevel: SensitivityLevel;
    reason: string;
    approvedBy?: string;
    expiresAtUtc?: string | null;
  }): Promise<string> {
    validateScope(input.scope);
    await this.ensureScope(input.scope);
    const actorId = input.actorId.trim();
    const providerId = input.providerId.trim();
    const reason = input.reason.trim();
    const approvedBy = input.approvedBy?.trim() || input.scope.actorId;

    if (!actorId) {
      throw new AppError('ACTOR_REQUIRED', 'actorId is required.');
    }
    if (!providerId) {
      throw new AppError('PROVIDER_REQUIRED', 'providerId is required.');
    }
    if (!reason) {
      throw new AppError('OVERRIDE_REASON_REQUIRED', 'reason is required.');
    }

    const overrideId = createId('policy-override');
    const now = new Date().toISOString();

    await this.runInTransaction(async () => {
      if (!this.tauriRuntime) {
        inMemoryState.policyOverrides.push({
          id: overrideId,
          workspaceId: input.scope.workspaceId,
          projectId: input.scope.projectId,
          actorId,
          providerId,
          sensitivityLevel: input.sensitivityLevel,
          reason,
          approvedBy,
          expiresAtUtc: input.expiresAtUtc ?? null,
          createdAtUtc: now,
          revokedAtUtc: null,
        });
      } else {
        await this.sqlite.execute(
          `
          INSERT INTO policy_overrides (
            id,
            workspace_id,
            project_id,
            actor_id,
            provider_id,
            sensitivity_level,
            reason,
            approved_by,
            expires_at_utc,
            created_at_utc,
            revoked_at_utc
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
          `,
          [
            overrideId,
            input.scope.workspaceId,
            input.scope.projectId,
            actorId,
            providerId,
            input.sensitivityLevel,
            reason,
            approvedBy,
            input.expiresAtUtc ?? null,
            now,
          ],
        );
      }

      await this.appendAudit(input.scope, {
        actorId: input.scope.actorId,
        action: 'policy.override.granted',
        entityType: 'policy_override',
        entityId: overrideId,
        metadata: {
          workspaceId: input.scope.workspaceId,
          projectId: input.scope.projectId,
          actorId,
          providerId,
          sensitivityLevel: input.sensitivityLevel,
          reason,
          approvedBy,
          expiresAtUtc: input.expiresAtUtc ?? null,
        },
        eventTsUtc: now,
      });
    });

    return overrideId;
  }

  private async ensureScope(scope: GovernanceScope): Promise<void> {
    validateScope(scope);
    const now = new Date().toISOString();
    const projectSeenInSession = this.projectWorkspaceMap.has(scope.projectId);
    this.projectWorkspaceMap.set(scope.projectId, scope.workspaceId);

    if (!this.tauriRuntime) {
      if (!projectSeenInSession) {
        await this.upsertProjectRoleBinding({
          workspaceId: scope.workspaceId,
          projectId: scope.projectId,
          actorId: scope.actorId,
          role: 'project_owner',
          grantedBy: scope.actorId,
          grantedAtUtc: now,
        });
      }
      return;
    }

    const projectExists = await this.projectExists(scope.projectId);
    await this.sqlite.execute(
      `
      INSERT OR IGNORE INTO workspaces (id, name, slug, created_at_utc, updated_at_utc)
      VALUES (?, ?, ?, ?, ?)
      `,
      [scope.workspaceId, `Workspace ${scope.workspaceId}`, scope.workspaceId, now, now],
    );

    await this.sqlite.execute(
      `
      INSERT OR IGNORE INTO projects (id, workspace_id, name, status, created_at_utc, updated_at_utc)
      VALUES (?, ?, ?, 'active', ?, ?)
      `,
      [scope.projectId, scope.workspaceId, `Project ${scope.projectId}`, now, now],
    );

    if (!projectExists) {
      await this.upsertProjectRoleBinding({
        workspaceId: scope.workspaceId,
        projectId: scope.projectId,
        actorId: scope.actorId,
        role: 'project_owner',
        grantedBy: scope.actorId,
        grantedAtUtc: now,
      });
    }
  }

  private async insertArtifactFromMetadata(
    context: ProjectContext,
    metadata: {
      objectHash: string;
      objectKey: string;
      sizeBytes: number;
      mimeType: string;
      originalName: string;
      artifactType: string;
      discipline: string;
      status: string;
      sensitivityLevel: SensitivityLevel;
      projectId: string;
      createdBy: string;
      createdAtUtc: string;
    },
  ): Promise<void> {
    const artifactId = createId('artifact');

    if (!this.tauriRuntime) {
      const existing = inMemoryState.artifacts.find(
        (row) => row.projectId === context.projectId && row.sha256 === metadata.objectHash,
      );
      if (existing) {
        return;
      }

      inMemoryState.artifacts.push({
        id: artifactId,
        projectId: context.projectId,
        artifactType: metadata.artifactType,
        discipline: metadata.discipline,
        status: metadata.status,
        sensitivityLevel: metadata.sensitivityLevel,
        sha256: metadata.objectHash,
        objectKey: metadata.objectKey,
        originalName: metadata.originalName,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        immutable: true,
        createdBy: metadata.createdBy,
        createdAtUtc: metadata.createdAtUtc,
      });
      return;
    }

    await this.sqlite.execute(
      `
      INSERT INTO artifacts (
        id,
        project_id,
        artifact_type,
        discipline,
        status,
        sensitivity_level,
        sha256,
        object_key,
        mime_type,
        size_bytes,
        original_name,
        created_by,
        created_at_utc,
        immutable
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(project_id, sha256) DO NOTHING
      `,
      [
        artifactId,
        context.projectId,
        metadata.artifactType,
        metadata.discipline,
        metadata.status,
        metadata.sensitivityLevel,
        metadata.objectHash,
        metadata.objectKey,
        metadata.mimeType,
        metadata.sizeBytes,
        metadata.originalName,
        metadata.createdBy,
        metadata.createdAtUtc,
      ],
    );
  }

  private async appendAudit(
    scope: GovernanceScope,
    event: {
      actorId: string;
      action: string;
      entityType: string;
      entityId: string;
      metadata?: Record<string, unknown>;
      eventTsUtc?: string;
    },
  ): Promise<void> {
    const audit = new AuditService(
      {
        getLatestByProject: async (workspaceId, projectId) =>
          this.getLatestAuditRecord(workspaceId, projectId),
        listByProject: async (workspaceId, projectId) => this.listAuditRecords(workspaceId, projectId),
        insert: async (record) => this.insertAuditRecord(record),
      },
      scope.workspaceId,
      scope.projectId,
    );

    const appended = await audit.appendAuditEvent(event);
    if (!appended.ok || !appended.value) {
      throw new AppError(appended.error?.code ?? 'AUDIT_APPEND_FAILED', appended.error?.message ?? 'Audit append failed.', appended.error);
    }
  }

  private async getLatestAuditRecord(workspaceId: string, projectId: string): Promise<AuditRecord | null> {
    if (!this.tauriRuntime) {
      const scoped = inMemoryState.auditRecords.filter(
        (row) => row.workspaceId === workspaceId && row.projectId === projectId,
      );
      if (scoped.length === 0) {
        return null;
      }
      return scoped[scoped.length - 1] ?? null;
    }

    const rows = await this.sqlite.select<{
      id: string;
      workspace_id: string;
      project_id: string;
      actor_id: string;
      action: string;
      entity_type: string;
      entity_id: string;
      event_ts_utc: string;
      prev_hash: string | null;
      event_hash: string;
      canonical_payload_json: string;
      hash_algorithm: 'sha256';
      chain_version: number;
    }>(
      `
      SELECT
        id,
        workspace_id,
        project_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        event_ts_utc,
        prev_hash,
        event_hash,
        canonical_payload_json,
        hash_algorithm,
        chain_version
      FROM audit_log
      WHERE workspace_id = ? AND project_id = ?
      ORDER BY event_ts_utc DESC, id DESC
      LIMIT 1
      `,
      [workspaceId, projectId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      eventTsUtc: row.event_ts_utc,
      prevHash: row.prev_hash,
      eventHash: row.event_hash,
      canonicalPayloadJson: row.canonical_payload_json,
      hashAlgorithm: row.hash_algorithm,
      chainVersion: Number(row.chain_version),
    };
  }

  private async listAuditRecords(workspaceId: string, projectId: string): Promise<readonly AuditRecord[]> {
    if (!this.tauriRuntime) {
      return inMemoryState.auditRecords
        .filter((row) => row.workspaceId === workspaceId && row.projectId === projectId)
        .slice()
        .sort((left, right) => left.eventTsUtc.localeCompare(right.eventTsUtc));
    }

    const rows = await this.sqlite.select<{
      id: string;
      workspace_id: string;
      project_id: string;
      actor_id: string;
      action: string;
      entity_type: string;
      entity_id: string;
      event_ts_utc: string;
      prev_hash: string | null;
      event_hash: string;
      canonical_payload_json: string;
      hash_algorithm: 'sha256';
      chain_version: number;
    }>(
      `
      SELECT
        id,
        workspace_id,
        project_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        event_ts_utc,
        prev_hash,
        event_hash,
        canonical_payload_json,
        hash_algorithm,
        chain_version
      FROM audit_log
      WHERE workspace_id = ? AND project_id = ?
      ORDER BY event_ts_utc ASC, id ASC
      `,
      [workspaceId, projectId],
    );

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      eventTsUtc: row.event_ts_utc,
      prevHash: row.prev_hash,
      eventHash: row.event_hash,
      canonicalPayloadJson: row.canonical_payload_json,
      hashAlgorithm: row.hash_algorithm,
      chainVersion: Number(row.chain_version),
    }));
  }

  private async insertAuditRecord(record: AuditRecord): Promise<void> {
    if (!this.tauriRuntime) {
      inMemoryState.auditRecords.push(record);
      inMemoryState.auditRecords.sort((left, right) => left.eventTsUtc.localeCompare(right.eventTsUtc));
      return;
    }

    await this.sqlite.execute(
      `
      INSERT INTO audit_log (
        id,
        workspace_id,
        project_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        event_ts_utc,
        prev_hash,
        event_hash,
        metadata_json,
        canonical_payload_json,
        hash_algorithm,
        chain_version
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        record.id,
        record.workspaceId,
        record.projectId,
        record.actorId,
        record.action,
        record.entityType,
        record.entityId,
        record.eventTsUtc,
        record.prevHash,
        record.eventHash,
        record.canonicalPayloadJson,
        record.canonicalPayloadJson,
        record.hashAlgorithm,
        record.chainVersion,
      ],
    );
  }

  private async getArtifactForDeliverable(
    projectId: string,
    artifactId: string,
  ): Promise<{
    id: string;
    projectId: string;
    sha256: string;
    objectKey: string;
    artifactType: string;
    sensitivityLevel: SensitivityLevel;
    immutable: boolean;
  } | null> {
    const row = await this.getArtifactByProjectAndId(projectId, artifactId);
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      projectId: row.projectId,
      sha256: row.sha256,
      objectKey: row.objectKey,
      artifactType: row.artifactType,
      sensitivityLevel: row.sensitivityLevel,
      immutable: row.immutable,
    };
  }

  private async getDeliverableRow(
    projectId: string,
    deliverableId: string,
  ): Promise<{ id: string; projectId: string; currentVersionNo: number; status: 'finalized' } | null> {
    if (!this.tauriRuntime) {
      const row =
        inMemoryState.deliverables.find(
          (item) => item.id === deliverableId && item.projectId === projectId,
        ) ?? null;
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        projectId: row.projectId,
        currentVersionNo: row.currentVersionNo,
        status: row.status,
      };
    }

    const rows = await this.sqlite.select<{
      id: string;
      project_id: string;
      current_version_no: number;
      status: 'finalized';
    }>(
      `
      SELECT id, project_id, current_version_no, status
      FROM deliverables
      WHERE id = ? AND project_id = ?
      LIMIT 1
      `,
      [deliverableId, projectId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      projectId: row.project_id,
      currentVersionNo: Number(row.current_version_no),
      status: row.status,
    };
  }

  private async createDeliverableRow(input: {
    deliverableId: string;
    projectId: string;
    createdBy: string;
    createdAtUtc: string;
  }): Promise<{ id: string; projectId: string; currentVersionNo: number; status: 'finalized' }> {
    if (!this.tauriRuntime) {
      const row: DeliverableRow = {
        id: input.deliverableId,
        projectId: input.projectId,
        currentVersionNo: 1,
        status: 'finalized',
        createdBy: input.createdBy,
        createdAtUtc: input.createdAtUtc,
        updatedAtUtc: input.createdAtUtc,
      };
      inMemoryState.deliverables.push(row);
      return {
        id: row.id,
        projectId: row.projectId,
        currentVersionNo: row.currentVersionNo,
        status: row.status,
      };
    }

    await this.sqlite.execute(
      `
      INSERT INTO deliverables (
        id,
        project_id,
        current_version_no,
        status,
        created_by,
        created_at_utc,
        updated_at_utc
      )
      VALUES (?, ?, 1, 'finalized', ?, ?, ?)
      `,
      [input.deliverableId, input.projectId, input.createdBy, input.createdAtUtc, input.createdAtUtc],
    );

    return {
      id: input.deliverableId,
      projectId: input.projectId,
      currentVersionNo: 1,
      status: 'finalized',
    };
  }

  private async updateDeliverableCurrentVersion(
    deliverableId: string,
    versionNo: number,
    updatedAtUtc: string,
  ): Promise<void> {
    if (!this.tauriRuntime) {
      const row = inMemoryState.deliverables.find((item) => item.id === deliverableId);
      if (!row) {
        throw new AppError('DELIVERABLE_NOT_FOUND', 'Deliverable was not found.', { deliverableId });
      }
      row.currentVersionNo = versionNo;
      row.updatedAtUtc = updatedAtUtc;
      return;
    }

    await this.sqlite.execute(
      `
      UPDATE deliverables
      SET current_version_no = ?, updated_at_utc = ?
      WHERE id = ?
      `,
      [versionNo, updatedAtUtc, deliverableId],
    );
  }

  private async getCurrentDeliverableVersion(
    deliverableId: string,
  ): Promise<{
    id: string;
    deliverableId: string;
    versionNo: number;
    artifactId: string;
    artifactHash: string;
    parentVersionId: string | null;
  } | null> {
    if (!this.tauriRuntime) {
      const row =
        inMemoryState.deliverableVersions
          .filter((item) => item.deliverableId === deliverableId)
          .sort((left, right) => right.versionNo - left.versionNo)[0] ?? null;
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        deliverableId: row.deliverableId,
        versionNo: row.versionNo,
        artifactId: row.artifactId,
        artifactHash: row.artifactHash,
        parentVersionId: row.parentVersionId,
      };
    }

    const rows = await this.sqlite.select<{
      id: string;
      deliverable_id: string;
      version_no: number;
      artifact_id: string;
      artifact_hash: string;
      parent_version_id: string | null;
    }>(
      `
      SELECT
        id,
        deliverable_id,
        version_no,
        artifact_id,
        artifact_hash,
        parent_version_id
      FROM deliverable_versions
      WHERE deliverable_id = ?
      ORDER BY version_no DESC
      LIMIT 1
      `,
      [deliverableId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      deliverableId: row.deliverable_id,
      versionNo: Number(row.version_no),
      artifactId: row.artifact_id,
      artifactHash: row.artifact_hash,
      parentVersionId: row.parent_version_id,
    };
  }

  private async insertDeliverableVersionRow(input: {
    versionId: string;
    deliverableId: string;
    versionNo: number;
    artifactId: string;
    artifactHash: string;
    parentVersionId: string | null;
    reason: string;
    createdBy: string;
    createdAtUtc: string;
  }): Promise<{
    id: string;
    deliverableId: string;
    versionNo: number;
    artifactId: string;
    artifactHash: string;
    parentVersionId: string | null;
  }> {
    if (!this.tauriRuntime) {
      const row: DeliverableVersionRow = {
        id: input.versionId,
        deliverableId: input.deliverableId,
        versionNo: input.versionNo,
        artifactId: input.artifactId,
        artifactHash: input.artifactHash,
        parentVersionId: input.parentVersionId,
        changeReason: input.reason,
        createdBy: input.createdBy,
        createdAtUtc: input.createdAtUtc,
      };
      inMemoryState.deliverableVersions.push(row);
      return {
        id: row.id,
        deliverableId: row.deliverableId,
        versionNo: row.versionNo,
        artifactId: row.artifactId,
        artifactHash: row.artifactHash,
        parentVersionId: row.parentVersionId,
      };
    }

    await this.sqlite.execute(
      `
      INSERT INTO deliverable_versions (
        id,
        deliverable_id,
        version_no,
        artifact_id,
        artifact_hash,
        parent_version_id,
        change_reason,
        created_by,
        created_at_utc
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.versionId,
        input.deliverableId,
        input.versionNo,
        input.artifactId,
        input.artifactHash,
        input.parentVersionId,
        input.reason,
        input.createdBy,
        input.createdAtUtc,
      ],
    );

    return {
      id: input.versionId,
      deliverableId: input.deliverableId,
      versionNo: input.versionNo,
      artifactId: input.artifactId,
      artifactHash: input.artifactHash,
      parentVersionId: input.parentVersionId,
    };
  }

  private async runInTransaction<T>(action: () => Promise<T>): Promise<T> {
    if (!this.tauriRuntime) {
      return action();
    }

    if (this.transactionDepth > 0) {
      return action();
    }

    this.transactionDepth += 1;
    await this.sqlite.execute('BEGIN IMMEDIATE');

    try {
      const result = await action();
      await this.sqlite.execute('COMMIT');
      return result;
    } catch (error) {
      try {
        await this.sqlite.execute('ROLLBACK');
      } catch {
        // Best effort rollback; preserve original failure.
      }
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  private async listArtifactRows(projectId: string): Promise<ArtifactRow[]> {
    if (!this.tauriRuntime) {
      return inMemoryState.artifacts
        .filter((row) => row.projectId === projectId)
        .slice()
        .sort((left, right) => right.createdAtUtc.localeCompare(left.createdAtUtc));
    }

    const rows = await this.sqlite.select<{
      id: string;
      project_id: string;
      artifact_type: string;
      discipline: string;
      status: string;
      sensitivity_level: SensitivityLevel;
      sha256: string;
      object_key: string;
      mime_type: string;
      size_bytes: number;
      original_name: string;
      immutable: number;
      created_by: string;
      created_at_utc: string;
    }>(
      `
      SELECT
        id,
        project_id,
        artifact_type,
        discipline,
        status,
        sensitivity_level,
        sha256,
        object_key,
        mime_type,
        size_bytes,
        original_name,
        immutable,
        created_by,
        created_at_utc
      FROM artifacts
      WHERE project_id = ?
      ORDER BY created_at_utc DESC
      `,
      [projectId],
    );

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      artifactType: row.artifact_type,
      discipline: row.discipline,
      status: row.status,
      sensitivityLevel: row.sensitivity_level,
      sha256: row.sha256,
      objectKey: row.object_key,
      originalName: row.original_name,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      immutable: Number(row.immutable) === 1,
      createdBy: row.created_by,
      createdAtUtc: row.created_at_utc,
    }));
  }

  private async getArtifactByProjectAndId(projectId: string, artifactId: string): Promise<ArtifactRow | null> {
    if (!this.tauriRuntime) {
      return inMemoryState.artifacts.find((row) => row.id === artifactId && row.projectId === projectId) ?? null;
    }

    const rows = await this.sqlite.select<{
      id: string;
      project_id: string;
      artifact_type: string;
      discipline: string;
      status: string;
      sensitivity_level: SensitivityLevel;
      sha256: string;
      object_key: string;
      mime_type: string;
      size_bytes: number;
      original_name: string;
      immutable: number;
      created_by: string;
      created_at_utc: string;
    }>(
      `
      SELECT
        id,
        project_id,
        artifact_type,
        discipline,
        status,
        sensitivity_level,
        sha256,
        object_key,
        mime_type,
        size_bytes,
        original_name,
        immutable,
        created_by,
        created_at_utc
      FROM artifacts
      WHERE id = ? AND project_id = ?
      LIMIT 1
      `,
      [artifactId, projectId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      projectId: row.project_id,
      artifactType: row.artifact_type,
      discipline: row.discipline,
      status: row.status,
      sensitivityLevel: row.sensitivity_level,
      sha256: row.sha256,
      objectKey: row.object_key,
      originalName: row.original_name,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      immutable: Number(row.immutable) === 1,
      createdBy: row.created_by,
      createdAtUtc: row.created_at_utc,
    };
  }

  private async getArtifactByProjectAndHash(projectId: string, hash: string): Promise<ArtifactRow | null> {
    if (!this.tauriRuntime) {
      return inMemoryState.artifacts.find((row) => row.projectId === projectId && row.sha256 === hash) ?? null;
    }

    const rows = await this.sqlite.select<{
      id: string;
      project_id: string;
      artifact_type: string;
      discipline: string;
      status: string;
      sensitivity_level: SensitivityLevel;
      sha256: string;
      object_key: string;
      mime_type: string;
      size_bytes: number;
      original_name: string;
      immutable: number;
      created_by: string;
      created_at_utc: string;
    }>(
      `
      SELECT
        id,
        project_id,
        artifact_type,
        discipline,
        status,
        sensitivity_level,
        sha256,
        object_key,
        mime_type,
        size_bytes,
        original_name,
        immutable,
        created_by,
        created_at_utc
      FROM artifacts
      WHERE project_id = ? AND sha256 = ?
      LIMIT 1
      `,
      [projectId, hash],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      projectId: row.project_id,
      artifactType: row.artifact_type,
      discipline: row.discipline,
      status: row.status,
      sensitivityLevel: row.sensitivity_level,
      sha256: row.sha256,
      objectKey: row.object_key,
      originalName: row.original_name,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      immutable: Number(row.immutable) === 1,
      createdBy: row.created_by,
      createdAtUtc: row.created_at_utc,
    };
  }

  private async requireArtifactByProjectAndHash(projectId: string, hash: string): Promise<void> {
    const row = await this.getArtifactByProjectAndHash(projectId, hash);
    if (!row) {
      throw new AppError('ARTIFACT_NOT_FOUND', 'Artifact was not found in scoped project.', {
        projectId,
        hash,
      });
    }
  }

  private async countArtifactVersions(artifactId: string): Promise<number> {
    if (!this.tauriRuntime) {
      return inMemoryState.deliverableVersions.filter((row) => row.artifactId === artifactId).length;
    }

    const rows = await this.sqlite.select<{ total: number }>(
      `
      SELECT COUNT(*) AS total
      FROM deliverable_versions
      WHERE artifact_id = ?
      `,
      [artifactId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  private async listArtifactVersionCounts(projectId: string): Promise<Map<string, number>> {
    if (!this.tauriRuntime) {
      const counts = new Map<string, number>();
      const scopedArtifactIds = new Set(
        inMemoryState.artifacts.filter((artifact) => artifact.projectId === projectId).map((artifact) => artifact.id),
      );
      for (const version of inMemoryState.deliverableVersions) {
        if (!scopedArtifactIds.has(version.artifactId)) {
          continue;
        }
        counts.set(version.artifactId, (counts.get(version.artifactId) ?? 0) + 1);
      }
      return counts;
    }

    const rows = await this.sqlite.select<{ artifact_id: string; total: number }>(
      `
      SELECT dv.artifact_id, COUNT(*) AS total
      FROM deliverable_versions dv
      INNER JOIN artifacts a ON a.id = dv.artifact_id
      WHERE a.project_id = ?
      GROUP BY dv.artifact_id
      `,
      [projectId],
    );

    const counts = new Map<string, number>();
    rows.forEach((row) => {
      counts.set(row.artifact_id, Number(row.total));
    });
    return counts;
  }

  private async projectExists(projectId: string): Promise<boolean> {
    if (!this.tauriRuntime) {
      return this.projectWorkspaceMap.has(projectId);
    }

    const rows = await this.sqlite.select<{ id: string }>(
      `
      SELECT id
      FROM projects
      WHERE id = ?
      LIMIT 1
      `,
      [projectId],
    );
    return Boolean(rows[0]);
  }

  private async upsertProjectRoleBinding(input: {
    workspaceId: string;
    projectId: string;
    actorId: string;
    role: ProjectRole;
    grantedBy: string;
    grantedAtUtc: string;
  }): Promise<void> {
    if (!this.tauriRuntime) {
      const existing = inMemoryState.projectRoleBindings.find(
        (row) =>
          row.projectId === input.projectId &&
          row.actorId === input.actorId &&
          row.role === input.role &&
          row.revokedAtUtc === null,
      );
      if (existing) {
        return;
      }
      inMemoryState.projectRoleBindings.push({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        actorId: input.actorId,
        role: input.role,
        grantedBy: input.grantedBy,
        grantedAtUtc: input.grantedAtUtc,
        revokedAtUtc: null,
      });
      return;
    }

    await this.sqlite.execute(
      `
      INSERT OR IGNORE INTO project_role_bindings (
        workspace_id,
        project_id,
        actor_id,
        role,
        granted_by,
        granted_at_utc,
        revoked_at_utc
      )
      VALUES (?, ?, ?, ?, ?, ?, NULL)
      `,
      [
        input.workspaceId,
        input.projectId,
        input.actorId,
        input.role,
        input.grantedBy,
        input.grantedAtUtc,
      ],
    );
  }

  private async hasProjectRoleBinding(
    projectId: string,
    actorId: string,
    roles: readonly ProjectRole[],
  ): Promise<boolean> {
    if (roles.length === 0) {
      return false;
    }

    if (!this.tauriRuntime) {
      return inMemoryState.projectRoleBindings.some(
        (row) =>
          row.projectId === projectId &&
          row.actorId === actorId &&
          row.revokedAtUtc === null &&
          roles.includes(row.role),
      );
    }

    const placeholders = roles.map(() => '?').join(', ');
    const rows = await this.sqlite.select<{ actor_id: string }>(
      `
      SELECT actor_id
      FROM project_role_bindings
      WHERE project_id = ?
        AND actor_id = ?
        AND revoked_at_utc IS NULL
        AND role IN (${placeholders})
      LIMIT 1
      `,
      [projectId, actorId, ...roles],
    );
    return Boolean(rows[0]);
  }

  private async hasExternalAiOverride(input: {
    projectId: string;
    actorId: string;
    providerId: string;
    sensitivityLevel: SensitivityLevel;
    overrideId?: string | null;
    asOfUtc: string;
  }): Promise<boolean> {
    const asOfMillis = Date.parse(input.asOfUtc);

    if (!this.tauriRuntime) {
      return inMemoryState.policyOverrides.some((row) => {
        if (row.projectId !== input.projectId) {
          return false;
        }
        if (row.actorId !== input.actorId) {
          return false;
        }
        if (row.providerId !== input.providerId) {
          return false;
        }
        if (row.sensitivityLevel !== input.sensitivityLevel) {
          return false;
        }
        if (row.revokedAtUtc !== null) {
          return false;
        }
        if (input.overrideId && row.id !== input.overrideId) {
          return false;
        }
        if (!row.expiresAtUtc) {
          return true;
        }
        return Date.parse(row.expiresAtUtc) > asOfMillis;
      });
    }

    const params: unknown[] = [
      input.projectId,
      input.actorId,
      input.providerId,
      input.sensitivityLevel,
      input.asOfUtc,
    ];
    let overrideWhere = '';
    if (input.overrideId) {
      overrideWhere = 'AND id = ?';
      params.push(input.overrideId);
    }

    const rows = await this.sqlite.select<{ id: string }>(
      `
      SELECT id
      FROM policy_overrides
      WHERE project_id = ?
        AND actor_id = ?
        AND provider_id = ?
        AND sensitivity_level = ?
        AND revoked_at_utc IS NULL
        AND (expires_at_utc IS NULL OR expires_at_utc > ?)
        ${overrideWhere}
      LIMIT 1
      `,
      params,
    );
    return Boolean(rows[0]);
  }

  private async tryAppendPolicyDeniedAudit(
    scope: GovernanceScope,
    operation: string,
    error: unknown,
  ): Promise<void> {
    if (!isAppError(error)) {
      return;
    }

    const code = error.code;
    if (
      !(
        code.startsWith('POLICY_') ||
        code === 'PROJECT_SCOPE_VIOLATION' ||
        code === 'DELIVERABLE_SCOPE_MISMATCH' ||
        code === 'EXTERNAL_AI_DEFAULT_DENY' ||
        code === 'EXTERNAL_AI_CONTEXT_REQUIRED'
      )
    ) {
      return;
    }

    try {
      await this.appendAudit(scope, {
        actorId: scope.actorId,
        action: 'policy.denied',
        entityType: 'policy',
        entityId: operation,
        metadata: {
          operation,
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
      });
    } catch {
      // Preserve original policy denial when audit append best-effort fails.
    }
  }

  private resolveWorkspaceId(projectId: string): string {
    return this.projectWorkspaceMap.get(projectId) ?? 'workspace-default';
  }
}

const toProjectContext = (scope: GovernanceScope): ProjectContext => {
  return {
    workspaceId: scope.workspaceId,
    projectId: scope.projectId,
    actorId: scope.actorId,
  };
};

const mapArtifactRow = (row: ArtifactRow, referencedVersionCount: number): ArtifactSummary => {
  return {
    ...row,
    referencedVersionCount,
  };
};

function validateScope(scope: GovernanceScope): void {
  if (!scope.workspaceId.trim()) {
    throw new AppError('WORKSPACE_REQUIRED', 'workspaceId is required.');
  }
  if (!scope.projectId.trim()) {
    throw new AppError('PROJECT_REQUIRED', 'projectId is required.');
  }
  if (!scope.actorId.trim()) {
    throw new AppError('ACTOR_REQUIRED', 'actorId is required.');
  }
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const toAppErrorMessage = (error: unknown): string => {
  if (isAppError(error)) {
    return `${error.code}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error.';
};
