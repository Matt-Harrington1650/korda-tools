import type { UpdateCheckResult, UpdaterService } from './UpdaterService';

export class WebUpdaterService implements UpdaterService {
  async checkForUpdates(): Promise<UpdateCheckResult> {
    return {
      supportedRuntime: false,
      available: false,
      currentVersion: null,
      latestVersion: null,
      publishedAt: null,
      notes: 'Update checks are only available in the desktop runtime.',
    };
  }
}

