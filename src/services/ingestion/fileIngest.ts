import { AppError, isAppError } from '../../lib/errors';
import type { Sha256Hex } from '../storage/ObjectStore';
import { sha256 } from '../crypto/sha256';

export interface FileIngestInput {
  bytes: Uint8Array;
  originalName: string;
  mimeType?: string;
  tempPath?: string;
}

export interface FileIngestResult {
  hash: Sha256Hex;
  size: number;
  mime: string;
  originalName: string;
  tempPath?: string;
}

export async function fileIngest(input: FileIngestInput): Promise<FileIngestResult> {
  try {
    if (input.bytes.byteLength === 0) {
      throw new AppError('INGEST_EMPTY_FILE', 'Cannot ingest empty content.');
    }

    const hash = await sha256(input.bytes);

    return {
      hash,
      size: input.bytes.byteLength,
      mime: input.mimeType ?? 'application/octet-stream',
      originalName: input.originalName,
      tempPath: input.tempPath,
    };
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    throw new AppError('INGEST_FAILED', 'Failed to ingest file payload.', error);
  }
}

// TODO: For Tauri desktop, map native file handles to Uint8Array via backend command.
// TODO: Enforce content-type allowlist and optional malware scanning hook.