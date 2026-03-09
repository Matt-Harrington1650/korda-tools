export type SophonRuntimeTransport =
  | 'in_process'
  | 'ipc_named_pipe'
  | 'ipc_unix_socket'
  | 'ipc_stdio'
  | 'http';

export type SophonOfflinePolicyInput = {
  offlineOnly: boolean;
  networkEgressEnabled: boolean;
  runtimeTransport: SophonRuntimeTransport;
};

export type SophonOfflinePolicyResult = {
  ok: boolean;
  errors: string[];
};

export const validateSophonOfflinePolicy = (
  input: SophonOfflinePolicyInput,
): SophonOfflinePolicyResult => {
  const errors: string[] = [];

  if (!input.offlineOnly) {
    errors.push('SOPHON_OFFLINE_ONLY_REQUIRED: Sophon must run in offline-only mode.');
  }

  if (input.networkEgressEnabled) {
    errors.push('SOPHON_EGRESS_BLOCK_REQUIRED: outbound network egress must remain disabled.');
  }

  if (input.runtimeTransport === 'http') {
    errors.push('SOPHON_HTTP_TRANSPORT_FORBIDDEN: HTTP transport is not allowed for runtime control.');
  }

  return {
    ok: errors.length === 0,
    errors,
  };
};

export const assertSophonOfflinePolicy = (input: SophonOfflinePolicyInput): void => {
  const result = validateSophonOfflinePolicy(input);
  if (!result.ok) {
    throw new Error(result.errors.join(' '));
  }
};
