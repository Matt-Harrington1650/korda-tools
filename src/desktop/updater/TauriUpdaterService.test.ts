import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetVersion = vi.fn();
const mockCheck = vi.fn();
const mockTauriApp = vi.fn();
const mockTauriUpdater = vi.fn();

vi.mock('../../lib/tauri', () => {
  return {
    tauriApp: mockTauriApp,
    tauriUpdater: mockTauriUpdater,
  };
});

describe('TauriUpdaterService', () => {
  beforeEach(() => {
    mockGetVersion.mockReset();
    mockCheck.mockReset();
    mockTauriApp.mockReset();
    mockTauriUpdater.mockReset();

    mockTauriApp.mockResolvedValue({
      getVersion: mockGetVersion,
    });
    mockTauriUpdater.mockResolvedValue({
      check: mockCheck,
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
      available: true,
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      publishedAt: '2026-02-24T00:00:00.000Z',
      notes: 'Bug fixes and improvements.',
    });
    expect(mockTauriApp).toHaveBeenCalledTimes(1);
    expect(mockTauriUpdater).toHaveBeenCalledTimes(1);
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
      available: false,
      currentVersion: '1.1.0',
      latestVersion: '1.1.0',
      publishedAt: null,
      notes: 'No updates available.',
    });
  });
});

