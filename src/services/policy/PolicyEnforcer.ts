import type {
  DeliverableFinalizePolicyInput,
  DeliverableVersionPolicyInput,
  ExternalAiPolicyInput,
  IntegrityCheckPolicyInput,
  ObjectIngestPolicyInput,
  PolicyDecision,
} from './types';

export interface PolicyEnforcer {
  authorizeObjectIngest(input: ObjectIngestPolicyInput): Promise<PolicyDecision>;
  authorizeDeliverableFinalize(input: DeliverableFinalizePolicyInput): Promise<PolicyDecision>;
  authorizeDeliverableVersion(input: DeliverableVersionPolicyInput): Promise<PolicyDecision>;
  authorizeIntegrityCheck(input: IntegrityCheckPolicyInput): Promise<PolicyDecision>;
  authorizeExternalAi(input: ExternalAiPolicyInput): Promise<PolicyDecision>;
}
