import { isTauriRuntime } from '../../lib/runtime';
import type { UpdaterService } from './UpdaterService';
import { TauriUpdaterService } from './TauriUpdaterService';
import { WebUpdaterService } from './WebUpdaterService';

export const createUpdaterService = (): UpdaterService => {
  if (isTauriRuntime()) {
    return new TauriUpdaterService();
  }

  return new WebUpdaterService();
};

