import type { UpdateCheckResult, UpdaterService } from './UpdaterService';
import { tauriApp, tauriUpdater } from '../../lib/tauri';

export class TauriUpdaterService implements UpdaterService {
  async checkForUpdates(): Promise<UpdateCheckResult> {
    const [appApi, updaterApi] = await Promise.all([tauriApp(), tauriUpdater()]);
    const currentVersion = await appApi.getVersion();
    const update = await updaterApi.check();

    if (!update) {
      return {
        supportedRuntime: true,
        available: false,
        currentVersion,
        latestVersion: currentVersion,
        publishedAt: null,
        notes: 'No updates available.',
      };
    }

    return {
      supportedRuntime: true,
      available: true,
      currentVersion,
      latestVersion: update.version,
      publishedAt: update.date ?? null,
      notes: update.body ?? '',
    };
  }
}

