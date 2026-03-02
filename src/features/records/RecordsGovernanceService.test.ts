import { describe, expect, it } from 'vitest';
import { RecordsGovernanceService, type GovernanceScope } from './RecordsGovernanceService';

const encoder = new TextEncoder();

const buildScope = (suffix: string): GovernanceScope => {
  return {
    workspaceId: `workspace-${suffix}`,
    projectId: `project-${suffix}`,
    actorId: `actor-${suffix}`,
  };
};

describe('RecordsGovernanceService', () => {
  it('ingests artifacts and enforces append-only deliverable versioning', async () => {
    const service = new RecordsGovernanceService();
    const scope = buildScope(`append-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    const artifactOne = await service.ingestArtifact({
      scope,
      bytes: encoder.encode('artifact-one'),
      originalName: 'P100_EL_DWG_CORE_480V_R0_20260302_ORIGIN_Draft.pdf',
      artifactType: 'issued_drawing',
      discipline: 'Electrical',
      status: 'Draft',
      sensitivityLevel: 'Internal',
      mimeType: 'application/pdf',
    });

    const finalized = await service.finalizeArtifact(scope, artifactOne.id, 'Initial issued package');

    const artifactTwo = await service.ingestArtifact({
      scope,
      bytes: encoder.encode('artifact-two'),
      originalName: 'P100_EL_DWG_CORE_480V_R1_20260303_ORIGIN_Issued.pdf',
      artifactType: 'issued_drawing',
      discipline: 'Electrical',
      status: 'Issued',
      sensitivityLevel: 'Internal',
      mimeType: 'application/pdf',
    });

    const versioned = await service.createDeliverableVersion(
      scope,
      finalized.deliverableId,
      artifactTwo.id,
      'Issued revision with corrected feeder callouts',
    );

    const versions = await service.listDeliverableVersions(scope, finalized.deliverableId);

    expect(versioned.versionNo).toBe(2);
    expect(versions).toHaveLength(2);
    expect(versions[0]?.artifactId).toBe(artifactTwo.id);
    expect(versions[1]?.artifactId).toBe(artifactOne.id);
  });

  it('rejects AI output artifact finalization as authoritative record', async () => {
    const service = new RecordsGovernanceService();
    const scope = buildScope(`authority-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    const artifact = await service.ingestArtifact({
      scope,
      bytes: encoder.encode('ai-generated-summary'),
      originalName: 'P100_AI_SUMMARY_CORE_GEN_R0_20260302_AI_Draft.md',
      artifactType: 'ai_output',
      discipline: 'General',
      status: 'Draft',
      sensitivityLevel: 'Internal',
      mimeType: 'text/markdown',
    });

    await expect(service.finalizeArtifact(scope, artifact.id, 'Attempting to publish AI output as record')).rejects.toMatchObject({
      code: 'ARTIFACT_AUTHORITY_REJECTED',
    });
  });
});
