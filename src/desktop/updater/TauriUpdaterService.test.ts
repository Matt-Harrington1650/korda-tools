import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetVersion = vi.fn();
const mockCheck = vi.fn();
const mockTauriApp = vi.fn();
const mockTauriUpdater = vi.fn();
const mockTauriInvoke = vi.fn();

vi.mock('../../lib/tauri', () => {
  return {
    tauriApp: mockTauriApp,
    tauriInvoke: mockTauriInvoke,
    tauriUpdater: mockTauriUpdater,
  };
});

describe('TauriUpdaterService', () => {
  beforeEach(() => {
    mockGetVersion.mockReset();
    mockCheck.mockReset();
    mockTauriApp.mockReset();
    mockTauriUpdater.mockReset();
    mockTauriInvoke.mockReset();

    mockTauriApp.mockResolvedValue({
      getVersion: mockGetVersion,
    });
    mockTauriUpdater.mockResolvedValue({
      check: mockCheck,
    });
    mockTauriInvoke.mockResolvedValue({
      currentVersion: '0.0.0',
      releaseChannel: 'stable',
      updaterConfigured: true,
      updaterEndpoint: 'https://example.test/latest.json',
    });
  });

  it('returns available update metadata', async () => {
    mockGetVersion.mockResolvedValueOnce('1.0.0');
    mockCheck.mockResolvedValueOnce({
      version: '1.1.0',
      date: '2026-02-24T00:00:00.000Z',
      body: 'Bug fixes and improvements.',
    });

    const { TauriUpdaterService } = await import('./TauriUpdaterService');
    const service = new TauriUpdaterService();
    const result = await service.checkForUpdates();

    expect(result).toEqual({
      supportedRuntime: true,
      updaterConfigured: true,
      available: true,
      currentVersion: '1.0.0',
      releaseChannel: 'stable',
      updaterEndpoint: 'https://example.test/latest.json',
      latestVersion: '1.1.0',
      publishedAt: '2026-02-24T00:00:00.000Z',
      notes: 'Bug fixes and improvements.',
      lastCheckedAt: expect.any(String),
    });
    expect(mockTauriApp).toHaveBeenCalledTimes(1);
    expect(mockTauriUpdater).toHaveBeenCalledTimes(1);
    expect(mockTauriInvoke).toHaveBeenCalledWith('app_get_release_info');
    expect(mockGetVersion).toHaveBeenCalledTimes(1);
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  it('returns no-update result when update check resolves null', async () => {
    mockGetVersion.mockResolvedValueOnce('1.1.0');
    mockCheck.mockResolvedValueOnce(null);

    const { TauriUpdaterService } = await import('./TauriUpdaterService');
    const service = new TauriUpdaterService();
    const result = await service.checkForUpdates();

    expect(result).toEqual({
      supportedRuntime: true,
      updaterConfigured: true,
      available: false,
      currentVersion: '1.1.0',
      releaseChannel: 'stable',
      updaterEndpoint: 'https://example.test/latest.json',
      latestVersion: '1.1.0',
      publishedAt: null,
      notes: 'No updates available.',
      lastCheckedAt: expect.any(String),
    });
  });
});
