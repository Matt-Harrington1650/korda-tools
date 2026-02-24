export type UpdateCheckResult = {
  supportedRuntime: boolean;
  available: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  publishedAt: string | null;
  notes: string;
};

export interface UpdaterService {
  checkForUpdates: () => Promise<UpdateCheckResult>;
}

