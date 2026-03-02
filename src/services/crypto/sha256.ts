import { AppError } from '../../lib/errors';
import type { Sha256Hex } from '../storage/ObjectStore';

const SHA256_HEX_LENGTH = 64;

export async function sha256(data: Uint8Array): Promise<Sha256Hex> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new AppError(
      'SHA256_UNAVAILABLE',
      'Web Crypto API is unavailable. Provide a runtime bridge for hashing.',
    );
  }

  const normalized = Uint8Array.from(data);
  const digestBuffer = await subtle.digest('SHA-256', normalized);
  const digestBytes = new Uint8Array(digestBuffer);
  const hash = toHex(digestBytes);

  if (hash.length !== SHA256_HEX_LENGTH) {
    throw new AppError('SHA256_LENGTH_MISMATCH', 'Generated hash length is invalid.', {
      length: hash.length,
    });
  }

  return hash;
}

const toHex = (bytes: Uint8Array): string => {
  let output = '';
  for (const value of bytes) {
    output += value.toString(16).padStart(2, '0');
  }

  return output;
};

// TODO: Add backend hash adapter for runtimes where Web Crypto is unavailable.
