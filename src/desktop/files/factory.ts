import { isTauriRuntime } from '../../lib/runtime';
import type { FileService } from './FileService';
import { TauriFileService } from './TauriFileService';
import { WebFileService } from './WebFileService';

export const createFileService = (): FileService => {
  if (isTauriRuntime()) {
    return new TauriFileService();
  }

  return new WebFileService();
};
