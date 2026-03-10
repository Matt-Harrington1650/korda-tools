export type UpdateRuntimeInfo = {
  supportedRuntime: boolean;
  updaterConfigured: boolean;
  currentVersion: string | null;
  releaseChannel: string;
  updaterEndpoint: string | null;
  notes: string;
};

export type UpdateCheckResult = {
  supportedRuntime: boolean;
  updaterConfigured: boolean;
  available: boolean;
  currentVersion: string | null;
  releaseChannel: string;
  updaterEndpoint: string | null;
  latestVersion: string | null;
  publishedAt: string | null;
  notes: string;
  lastCheckedAt: string | null;
};

export type UpdateInstallProgress = {
  phase: 'started' | 'progress' | 'finished';
  downloadedBytes: number;
  totalBytes: number | null;
};

export interface UpdaterService {
  getRuntimeInfo: () => Promise<UpdateRuntimeInfo>;
  checkForUpdates: () => Promise<UpdateCheckResult>;
  downloadAndInstall: (onProgress?: (progress: UpdateInstallProgress) => void) => Promise<void>;
}
