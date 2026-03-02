import { describe, expect, it } from 'vitest';
import { RecordsGovernanceService } from '../../src/features/records/RecordsGovernanceService';

const encoder = new TextEncoder();

describe('Records governance boundary evaluation harness', () => {
  it('denies cross-project finalize attempts even when artifact IDs are known', async () => {
    const service = new RecordsGovernanceService();

    const scopeA = {
      workspaceId: 'workspace-eval',
      projectId: 'project-a',
      actorId: 'actor-a',
    };

    const scopeB = {
      workspaceId: 'workspace-eval',
      projectId: 'project-b',
      actorId: 'actor-b',
    };

    const artifact = await service.ingestArtifact({
      scope: scopeA,
      bytes: encoder.encode('cross-project-boundary-check'),
      originalName: 'P200_EL_DWG_CORE_480V_R0_20260302_ORIGIN_Draft.pdf',
      artifactType: 'issued_drawing',
      discipline: 'Electrical',
      status: 'Draft',
      sensitivityLevel: 'Internal',
      mimeType: 'application/pdf',
    });

    await expect(
      service.finalizeArtifact(scopeB, artifact.id, 'Boundary check via known artifact id'),
    ).rejects.toMatchObject({
      code: 'PROJECT_SCOPE_VIOLATION',
    });

    const deliverablesA = await service.listDeliverables(scopeA);
    const deliverablesB = await service.listDeliverables(scopeB);

    expect(deliverablesA.length).toBe(0);
    expect(deliverablesB.length).toBe(0);
  });

  it('deduplicates duplicate payload hashes within the same project scope', async () => {
    const service = new RecordsGovernanceService();

    const scope = {
      workspaceId: 'workspace-eval',
      projectId: 'project-dedupe',
      actorId: 'actor-dedupe',
    };

    const payload = encoder.encode('same-content-for-dedupe');
    await service.ingestArtifact({
      scope,
      bytes: payload,
      originalName: 'P200_EL_SPEC_CORE_480V_R0_20260302_ORIGIN_Draft.pdf',
      artifactType: 'spec',
      discipline: 'Electrical',
      status: 'Draft',
      sensitivityLevel: 'Internal',
      mimeType: 'application/pdf',
    });
    await service.ingestArtifact({
      scope,
      bytes: payload,
      originalName: 'P200_EL_SPEC_CORE_480V_R0_20260302_ORIGIN_Draft_COPY.pdf',
      artifactType: 'spec',
      discipline: 'Electrical',
      status: 'Draft',
      sensitivityLevel: 'Internal',
      mimeType: 'application/pdf',
    });

    const artifacts = await service.listArtifacts(scope);
    expect(artifacts).toHaveLength(1);
  });
});

