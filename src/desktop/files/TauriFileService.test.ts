import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('TauriFileService', () => {
  beforeEach(() => {
    const runtime = globalThis as typeof globalThis & { showOpenFilePicker?: unknown; showSaveFilePicker?: unknown };
    runtime.showOpenFilePicker = undefined;
    runtime.showSaveFilePicker = undefined;
  });

  it('uses showOpenFilePicker when available', async () => {
    const runtime = globalThis as typeof globalThis & { showOpenFilePicker?: unknown };
    runtime.showOpenFilePicker = vi.fn().mockResolvedValue([
        {
          getFile: async () => new File(['{"ok":true}'], 'input.json', { type: 'application/json' }),
        },
      ]);
    const { TauriFileService } = await import('./TauriFileService');
    const service = new TauriFileService();

    const files = await service.pickRunFiles({
      maxFiles: 3,
      maxBytesPerFile: 1024,
    });

    expect(runtime.showOpenFilePicker).toHaveBeenCalledTimes(1);
    expect(files).toEqual([
      expect.objectContaining({
        name: 'input.json',
        mimeType: 'application/json',
      }),
    ]);
  });

  it('uses showSaveFilePicker when available', async () => {
    const write = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const runtime = globalThis as typeof globalThis & { showSaveFilePicker?: unknown };
    runtime.showSaveFilePicker = vi.fn().mockResolvedValue({
        name: 'run-output.json',
        createWritable: async () => ({
          write,
          close,
        }),
      });
    const { TauriFileService } = await import('./TauriFileService');
    const service = new TauriFileService();

    const result = await service.saveRunOutput({
      suggestedName: 'run-output.json',
      contents: '{"ok":true}',
    });

    expect(runtime.showSaveFilePicker).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('{"ok":true}');
    expect(close).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      saved: true,
      path: 'run-output.json',
    });
  });
});
