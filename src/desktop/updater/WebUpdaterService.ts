import type { UpdateCheckResult, UpdateRuntimeInfo, UpdaterService } from './UpdaterService';

export class WebUpdaterService implements UpdaterService {
  async getRuntimeInfo(): Promise<UpdateRuntimeInfo> {
    return {
      supportedRuntime: false,
      updaterConfigured: false,
      currentVersion: null,
      releaseChannel: 'web',
      updaterEndpoint: null,
      notes: 'Updates are only available in the desktop runtime.',
    };
  }

  async checkForUpdates(): Promise<UpdateCheckResult> {
    return {
      supportedRuntime: false,
      updaterConfigured: false,
      available: false,
      currentVersion: null,
      releaseChannel: 'web',
      updaterEndpoint: null,
      latestVersion: null,
      publishedAt: null,
      notes: 'Update checks are only available in the desktop runtime.',
      lastCheckedAt: new Date().toISOString(),
    };
  }

  async downloadAndInstall(): Promise<void> {
    throw new Error('Desktop updates are unavailable in the web runtime.');
  }
}
