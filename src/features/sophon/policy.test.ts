import { describe, expect, it } from 'vitest';
import { assertSophonOfflinePolicy, validateSophonOfflinePolicy } from './policy';

describe('Sophon offline policy', () => {
  it('passes when offline policy is strict and transport is private', () => {
    const result = validateSophonOfflinePolicy({
      offlineOnly: true,
      networkEgressEnabled: false,
      runtimeTransport: 'in_process',
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when network egress or HTTP transport is enabled', () => {
    const result = validateSophonOfflinePolicy({
      offlineOnly: true,
      networkEgressEnabled: true,
      runtimeTransport: 'http',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('SOPHON_EGRESS_BLOCK_REQUIRED'))).toBe(true);
    expect(result.errors.some((error) => error.includes('SOPHON_HTTP_TRANSPORT_FORBIDDEN'))).toBe(true);
  });

  it('throws when policy is violated', () => {
    expect(() => {
      assertSophonOfflinePolicy({
        offlineOnly: false,
        networkEgressEnabled: false,
        runtimeTransport: 'ipc_named_pipe',
      });
    }).toThrowError(/SOPHON_OFFLINE_ONLY_REQUIRED/);
  });
});

