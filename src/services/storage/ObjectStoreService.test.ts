import { describe, expect, it } from 'vitest';

import { AppError } from '../../lib/errors';
import type { PolicyEnforcer } from '../policy/PolicyEnforcer';
import { ObjectStoreService, type ObjectAuditAppender, type ObjectMetadataWriter } from './ObjectStoreService';
import type {
  ObjectMetadataRecord,
  ObjectStore,
  ObjectStorePutRequest,
  ObjectStorePutResult,
  ProjectContext,
  Sha256Hex,
} from './ObjectStore';

class FakeObjectStore implements ObjectStore {
  lastRequest: ObjectStorePutRequest | null = null;

  async putImmutable(request: ObjectStorePutRequest): Promise<ObjectStorePutResult> {
    this.lastRequest = request;
    return {
      hash: request.hash,
      objectKey: `/objects/${request.hash.slice(0, 2)}/${request.hash}`,
      sizeBytes: request.bytes.byteLength,
      committedAtUtc: '2026-03-02T00:00:00.000Z',
    };
  }

  async getReadonly(_context: ProjectContext, _hash: Sha256Hex): Promise<Uint8Array> {
    return new Uint8Array();
  }

  async exists(_context: ProjectContext, _hash: Sha256Hex): Promise<boolean> {
    return false;
  }
}

class FakeMetadataWriter implements ObjectMetadataWriter {
  lastWrite: ObjectMetadataRecord | null = null;

  async writeObjectMetadata(_context: ProjectContext, metadata: ObjectMetadataRecord): Promise<void> {
    this.lastWrite = metadata;
  }
}

class FakeAuditAppender implements ObjectAuditAppender {
  async appendObjectWrite(): Promise<void> {
    return;
  }
}

class AllowPolicyEnforcer implements PolicyEnforcer {
  async authorizeObjectIngest() {
    return {
      decision: 'allowed' as const,
      code: 'POLICY_ALLOWED_INGEST',
      reason: 'allowed',
    };
  }

  async authorizeDeliverableFinalize() {
    return {
      decision: 'blocked' as const,
      code: 'POLICY_NOT_USED',
      reason: 'not used in this test suite',
    };
  }

  async authorizeDeliverableVersion() {
    return {
      decision: 'blocked' as const,
      code: 'POLICY_NOT_USED',
      reason: 'not used in this test suite',
    };
  }

  async authorizeIntegrityCheck() {
    return {
      decision: 'blocked' as const,
      code: 'POLICY_NOT_USED',
      reason: 'not used in this test suite',
    };
  }

  async authorizeExternalAi() {
    return {
      decision: 'blocked' as const,
      code: 'POLICY_NOT_USED',
      reason: 'not used in this test suite',
    };
  }
}

describe('ObjectStoreService.put', () => {
  const context: ProjectContext = {
    workspaceId: 'ws-1',
    projectId: 'proj-1',
    actorId: 'actor-1',
  };

  it('rejects forbidden filename patterns', async () => {
    const service = new ObjectStoreService(
      new FakeObjectStore(),
      new FakeMetadataWriter(),
      new FakeAuditAppender(),
      new AllowPolicyEnforcer(),
    );

    await expect(
      service.put({
        context,
        bytes: new Uint8Array([1, 2, 3]),
        originalName: 'drawing_final_final_v7.pdf',
        artifactType: 'drawing',
        discipline: 'E',
        status: 'Draft',
        sensitivityLevel: 'Internal',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('persists required metadata fields on successful write', async () => {
    const metadataWriter = new FakeMetadataWriter();
    const service = new ObjectStoreService(
      new FakeObjectStore(),
      metadataWriter,
      new FakeAuditAppender(),
      new AllowPolicyEnforcer(),
    );

    await service.put({
      context,
      bytes: new Uint8Array([1, 2, 3]),
      originalName: 'TWR01_E_PLAN_CORE_POWER_R00_20260302_INT_Draft.pdf',
      artifactType: 'drawing',
      discipline: 'E',
      status: 'Draft',
      sensitivityLevel: 'Client-Confidential',
    });

    expect(metadataWriter.lastWrite).toMatchObject({
      artifactType: 'drawing',
      discipline: 'E',
      status: 'Draft',
      sensitivityLevel: 'Client-Confidential',
      projectId: 'proj-1',
      createdBy: 'actor-1',
    });
  });
});
