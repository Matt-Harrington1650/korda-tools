export type SensitivityLevel = 'Public' | 'Internal' | 'Confidential' | 'Client-Confidential';

export interface GovernanceScope {
  workspaceId: string;
  projectId: string;
  actorId: string;
}

export type ProjectRole = 'project_owner' | 'records_publisher' | 'records_viewer' | 'ai_operator';

export type PolicyDecisionKind = 'allowed' | 'blocked' | 'override';

export interface PolicyDecision {
  decision: PolicyDecisionKind;
  code: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface PolicyArtifactInput {
  id: string;
  projectId: string;
  artifactType: string;
  sensitivityLevel: SensitivityLevel;
}

export interface PolicyDeliverableInput {
  id: string;
  projectId: string;
  status: 'finalized';
}

export interface ObjectIngestPolicyInput {
  scope: GovernanceScope;
  artifactType: string;
  status: string;
  sensitivityLevel: SensitivityLevel;
}

export interface DeliverableFinalizePolicyInput {
  scope: GovernanceScope;
  artifact: PolicyArtifactInput;
}

export interface DeliverableVersionPolicyInput {
  scope: GovernanceScope;
  deliverable: PolicyDeliverableInput;
  artifact: PolicyArtifactInput;
}

export interface IntegrityCheckPolicyInput {
  scope: GovernanceScope;
  artifact: PolicyArtifactInput;
}

export interface ExternalAiPolicyInput {
  scope: GovernanceScope | null;
  providerId: string;
  sensitivityLevel: SensitivityLevel;
  overrideId?: string | null;
}

export interface ExternalAiOverrideLookupInput {
  projectId: string;
  actorId: string;
  providerId: string;
  sensitivityLevel: SensitivityLevel;
  overrideId?: string | null;
  asOfUtc: string;
}

export interface PolicyRepository {
  hasProjectRole(projectId: string, actorId: string, roles: readonly ProjectRole[]): Promise<boolean>;
  hasExternalAiOverride(input: ExternalAiOverrideLookupInput): Promise<boolean>;
}

export const allowPolicyDecision = (code: string, reason: string): PolicyDecision => {
  return {
    decision: 'allowed',
    code,
    reason,
  };
};

export const allowOverridePolicyDecision = (code: string, reason: string): PolicyDecision => {
  return {
    decision: 'override',
    code,
    reason,
  };
};

export const denyPolicyDecision = (code: string, reason: string): PolicyDecision => {
  return {
    decision: 'blocked',
    code,
    reason,
  };
};
