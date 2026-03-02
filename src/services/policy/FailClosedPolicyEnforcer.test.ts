import { describe, expect, it } from 'vitest';

import { FailClosedPolicyEnforcer } from './FailClosedPolicyEnforcer';
import type { PolicyRepository, ProjectRole } from './types';

const createRepository = (input: {
  rolesByActor?: Record<string, readonly ProjectRole[]>;
  hasOverride?: boolean;
}): PolicyRepository => {
  return {
    hasProjectRole: async (_projectId, actorId, roles) => {
      const actorRoles = input.rolesByActor?.[actorId] ?? [];
      return actorRoles.some((role) => roles.includes(role));
    },
    hasExternalAiOverride: async () => input.hasOverride ?? false,
  };
};

describe('FailClosedPolicyEnforcer', () => {
  it('denies external AI when governance context is missing', async () => {
    const enforcer = new FailClosedPolicyEnforcer(createRepository({}));

    const decision = await enforcer.authorizeExternalAi({
      scope: null,
      providerId: 'api.openai.com',
      sensitivityLevel: 'Internal',
      overrideId: null,
    });

    expect(decision).toMatchObject({
      decision: 'blocked',
      code: 'EXTERNAL_AI_CONTEXT_REQUIRED',
    });
  });

  it('denies external AI by default without override', async () => {
    const enforcer = new FailClosedPolicyEnforcer(
      createRepository({
        rolesByActor: {
          'actor-1': ['ai_operator'],
        },
        hasOverride: false,
      }),
    );

    const decision = await enforcer.authorizeExternalAi({
      scope: {
        workspaceId: 'workspace-1',
        projectId: 'project-1',
        actorId: 'actor-1',
      },
      providerId: 'api.openai.com',
      sensitivityLevel: 'Internal',
      overrideId: null,
    });

    expect(decision).toMatchObject({
      decision: 'blocked',
      code: 'EXTERNAL_AI_DEFAULT_DENY',
    });
  });

  it('allows external AI only with approved override', async () => {
    const enforcer = new FailClosedPolicyEnforcer(
      createRepository({
        rolesByActor: {
          'actor-1': ['ai_operator'],
        },
        hasOverride: true,
      }),
    );

    const decision = await enforcer.authorizeExternalAi({
      scope: {
        workspaceId: 'workspace-1',
        projectId: 'project-1',
        actorId: 'actor-1',
      },
      providerId: 'api.openai.com',
      sensitivityLevel: 'Confidential',
      overrideId: 'override-1',
    });

    expect(decision).toMatchObject({
      decision: 'override',
      code: 'POLICY_ALLOWED_EXTERNAL_AI_OVERRIDE',
    });
  });

  it('denies Client-Confidential ingest unless actor is project_owner', async () => {
    const enforcer = new FailClosedPolicyEnforcer(
      createRepository({
        rolesByActor: {
          'actor-1': ['records_publisher'],
        },
      }),
    );

    const decision = await enforcer.authorizeObjectIngest({
      scope: {
        workspaceId: 'workspace-1',
        projectId: 'project-1',
        actorId: 'actor-1',
      },
      artifactType: 'spec',
      status: 'Draft',
      sensitivityLevel: 'Client-Confidential',
    });

    expect(decision).toMatchObject({
      decision: 'blocked',
      code: 'POLICY_CLIENT_CONFIDENTIAL_INGEST_OWNER_REQUIRED',
    });
  });
});
