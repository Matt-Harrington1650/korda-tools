import type { PolicyEnforcer } from './PolicyEnforcer';
import {
  allowOverridePolicyDecision,
  allowPolicyDecision,
  denyPolicyDecision,
  type DeliverableFinalizePolicyInput,
  type DeliverableVersionPolicyInput,
  type ExternalAiPolicyInput,
  type IntegrityCheckPolicyInput,
  type ObjectIngestPolicyInput,
  type PolicyDecision,
  type PolicyRepository,
  type ProjectRole,
} from './types';

const INGEST_ROLES: readonly ProjectRole[] = ['project_owner', 'records_publisher'];
const FINALIZE_ROLES: readonly ProjectRole[] = ['project_owner', 'records_publisher'];
const VERSION_ROLES: readonly ProjectRole[] = ['project_owner', 'records_publisher'];
const INTEGRITY_ROLES: readonly ProjectRole[] = ['project_owner', 'records_publisher', 'records_viewer'];
const EXTERNAL_AI_ROLES: readonly ProjectRole[] = ['project_owner', 'ai_operator'];

export class FailClosedPolicyEnforcer implements PolicyEnforcer {
  private readonly repository: PolicyRepository;

  constructor(repository: PolicyRepository) {
    this.repository = repository;
  }

  async authorizeObjectIngest(input: ObjectIngestPolicyInput): Promise<PolicyDecision> {
    const hasRole = await this.repository.hasProjectRole(input.scope.projectId, input.scope.actorId, INGEST_ROLES);
    if (!hasRole) {
      return denyPolicyDecision('POLICY_ROLE_REQUIRED_FOR_INGEST', 'Actor is not authorized to ingest artifacts.');
    }

    if (input.sensitivityLevel === 'Client-Confidential') {
      const hasOwnerRole = await this.repository.hasProjectRole(input.scope.projectId, input.scope.actorId, [
        'project_owner',
      ]);
      if (!hasOwnerRole) {
        return denyPolicyDecision(
          'POLICY_CLIENT_CONFIDENTIAL_INGEST_OWNER_REQUIRED',
          'Client-Confidential ingest requires project_owner role.',
        );
      }
    }

    return allowPolicyDecision('POLICY_ALLOWED_INGEST', 'Object ingest policy checks passed.');
  }

  async authorizeDeliverableFinalize(input: DeliverableFinalizePolicyInput): Promise<PolicyDecision> {
    if (input.artifact.projectId !== input.scope.projectId) {
      return denyPolicyDecision(
        'PROJECT_SCOPE_VIOLATION',
        'Artifact project does not match scope project for finalize operation.',
      );
    }

    const hasRole = await this.repository.hasProjectRole(input.scope.projectId, input.scope.actorId, FINALIZE_ROLES);
    if (!hasRole) {
      return denyPolicyDecision('POLICY_ROLE_REQUIRED_FOR_FINALIZE', 'Actor is not authorized to finalize deliverables.');
    }

    return allowPolicyDecision('POLICY_ALLOWED_FINALIZE', 'Deliverable finalize policy checks passed.');
  }

  async authorizeDeliverableVersion(input: DeliverableVersionPolicyInput): Promise<PolicyDecision> {
    if (input.artifact.projectId !== input.scope.projectId) {
      return denyPolicyDecision(
        'PROJECT_SCOPE_VIOLATION',
        'Artifact project does not match scope project for version operation.',
      );
    }

    if (input.deliverable.projectId !== input.scope.projectId) {
      return denyPolicyDecision(
        'DELIVERABLE_SCOPE_MISMATCH',
        'Deliverable project does not match scope project for version operation.',
      );
    }

    const hasRole = await this.repository.hasProjectRole(input.scope.projectId, input.scope.actorId, VERSION_ROLES);
    if (!hasRole) {
      return denyPolicyDecision(
        'POLICY_ROLE_REQUIRED_FOR_VERSION',
        'Actor is not authorized to create deliverable versions.',
      );
    }

    return allowPolicyDecision('POLICY_ALLOWED_VERSION', 'Deliverable version policy checks passed.');
  }

  async authorizeIntegrityCheck(input: IntegrityCheckPolicyInput): Promise<PolicyDecision> {
    if (input.artifact.projectId !== input.scope.projectId) {
      return denyPolicyDecision(
        'PROJECT_SCOPE_VIOLATION',
        'Artifact project does not match scope project for integrity check.',
      );
    }

    const hasRole = await this.repository.hasProjectRole(input.scope.projectId, input.scope.actorId, INTEGRITY_ROLES);
    if (!hasRole) {
      return denyPolicyDecision(
        'POLICY_ROLE_REQUIRED_FOR_INTEGRITY',
        'Actor is not authorized to verify artifact integrity.',
      );
    }

    return allowPolicyDecision('POLICY_ALLOWED_INTEGRITY', 'Artifact integrity policy checks passed.');
  }

  async authorizeExternalAi(input: ExternalAiPolicyInput): Promise<PolicyDecision> {
    if (!input.scope) {
      return denyPolicyDecision(
        'EXTERNAL_AI_CONTEXT_REQUIRED',
        'External AI usage requires governance scope context.',
      );
    }

    const hasRole = await this.repository.hasProjectRole(input.scope.projectId, input.scope.actorId, EXTERNAL_AI_ROLES);
    if (!hasRole) {
      return denyPolicyDecision(
        'POLICY_ROLE_REQUIRED_FOR_EXTERNAL_AI',
        'Actor is not authorized to request external AI usage.',
      );
    }

    const overrideFound = await this.repository.hasExternalAiOverride({
      projectId: input.scope.projectId,
      actorId: input.scope.actorId,
      providerId: input.providerId,
      sensitivityLevel: input.sensitivityLevel,
      overrideId: input.overrideId,
      asOfUtc: new Date().toISOString(),
    });

    if (!overrideFound) {
      return denyPolicyDecision(
        'EXTERNAL_AI_DEFAULT_DENY',
        'External AI usage is denied by default without an approved override.',
      );
    }

    return allowOverridePolicyDecision(
      'POLICY_ALLOWED_EXTERNAL_AI_OVERRIDE',
      'External AI usage approved by active override.',
    );
  }
}
