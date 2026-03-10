import type {
  UpdateCheckResult,
  UpdateInstallProgress,
  UpdateRuntimeInfo,
  UpdaterService,
} from './UpdaterService';
import { tauriApp, tauriInvoke, tauriUpdater } from '../../lib/tauri';

type ReleaseInfo = {
  currentVersion: string;
  releaseChannel: string;
  updaterConfigured: boolean;
  updaterEndpoint?: string | null;
};

export class TauriUpdaterService implements UpdaterService {
  private pendingUpdate: Awaited<ReturnType<(typeof import('@tauri-apps/plugin-updater'))['check']>> = null;

  async getRuntimeInfo(): Promise<UpdateRuntimeInfo> {
    const [appApi, releaseInfo] = await Promise.all([
      tauriApp(),
      tauriInvoke<ReleaseInfo>('app_get_release_info'),
    ]);
    const currentVersion = await appApi.getVersion();
    return {
      supportedRuntime: true,
      updaterConfigured: releaseInfo.updaterConfigured,
      currentVersion,
      releaseChannel: releaseInfo.releaseChannel,
      updaterEndpoint: releaseInfo.updaterEndpoint ?? null,
      notes: releaseInfo.updaterConfigured
        ? 'Updater is configured for this desktop build.'
        : 'Updater is not configured for this build.',
    };
  }

  async checkForUpdates(): Promise<UpdateCheckResult> {
    const [runtimeInfo, updaterApi] = await Promise.all([
      this.getRuntimeInfo(),
      tauriUpdater(),
    ]);

    if (!runtimeInfo.updaterConfigured) {
      this.pendingUpdate = null;
      return {
        ...runtimeInfo,
        available: false,
        latestVersion: runtimeInfo.currentVersion,
        publishedAt: null,
        notes: runtimeInfo.notes,
        lastCheckedAt: new Date().toISOString(),
      };
    }

    const update = await updaterApi.check();
    this.pendingUpdate = update;

    if (!update) {
      return {
        ...runtimeInfo,
        available: false,
        latestVersion: runtimeInfo.currentVersion,
        publishedAt: null,
        notes: 'No updates available.',
        lastCheckedAt: new Date().toISOString(),
      };
    }

    return {
      ...runtimeInfo,
      available: true,
      latestVersion: update.version,
      publishedAt: update.date ?? null,
      notes: update.body ?? '',
      lastCheckedAt: new Date().toISOString(),
    };
  }

  async downloadAndInstall(
    onProgress?: (progress: UpdateInstallProgress) => void,
  ): Promise<void> {
    if (!this.pendingUpdate) {
      throw new Error('Check for updates before downloading an update.');
    }

    let downloadedBytes = 0;
    let totalBytes: number | null = null;
    try {
      await this.pendingUpdate.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          totalBytes = event.data.contentLength ?? null;
          downloadedBytes = 0;
          onProgress?.({ phase: 'started', downloadedBytes, totalBytes });
          return;
        }
        if (event.event === 'Progress') {
          downloadedBytes += event.data.chunkLength;
          onProgress?.({ phase: 'progress', downloadedBytes, totalBytes });
          return;
        }
        onProgress?.({ phase: 'finished', downloadedBytes, totalBytes });
      });
    } finally {
      await this.pendingUpdate.close();
      this.pendingUpdate = null;
    }
  }
}
