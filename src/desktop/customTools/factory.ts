import { isTauriRuntime } from '../../lib/runtime';
import type { CustomToolsLibraryService } from './CustomToolsLibraryService';
import { TauriCustomToolsLibraryService } from './TauriCustomToolsLibraryService';
import { WebCustomToolsLibraryService } from './WebCustomToolsLibraryService';

export const createCustomToolsLibraryService = (): CustomToolsLibraryService => {
  if (isTauriRuntime()) {
    return new TauriCustomToolsLibraryService();
  }

  return new WebCustomToolsLibraryService();
};
