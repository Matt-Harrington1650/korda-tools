import type { FileService, PickRunFilesOptions, RunAttachment, SaveRunOutputOptions, SaveRunOutputResult } from './FileService';
import { WebFileService } from './WebFileService';

const DEFAULT_MAX_BYTES_PER_FILE = 2 * 1024 * 1024;

type FilePickerWindow = {
  showOpenFilePicker?: (options?: { multiple?: boolean }) => Promise<Array<{ getFile: () => Promise<File> }>>;
  showSaveFilePicker?: (options?: { suggestedName?: string }) => Promise<{
    name?: string;
    createWritable: () => Promise<{ write: (value: string) => Promise<void>; close: () => Promise<void> }>;
  }>;
};

const toAttachmentId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const resolveMaxBytesPerFile = (value?: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_MAX_BYTES_PER_FILE;
  }

  return Math.max(1024, Math.min(10 * 1024 * 1024, Math.trunc(value)));
};

export class TauriFileService implements FileService {
  private readonly webFallback = new WebFileService();

  async pickRunFiles(options: PickRunFilesOptions = {}): Promise<RunAttachment[]> {
    const runtimeWindow = globalThis as typeof globalThis & FilePickerWindow;
    if (typeof runtimeWindow.showOpenFilePicker !== 'function') {
      return this.webFallback.pickRunFiles(options);
    }

    const handles = await runtimeWindow.showOpenFilePicker({
      multiple: options.multiple ?? true,
    });
    const maxFiles = Math.max(1, Math.min(10, Math.trunc(options.maxFiles ?? 5)));
    const maxBytesPerFile = resolveMaxBytesPerFile(options.maxBytesPerFile);
    const selected = handles.slice(0, maxFiles);

    return Promise.all(
      selected.map(async (handle) => {
        const file = await handle.getFile();
        if (file.size > maxBytesPerFile) {
          throw new Error(`File "${file.name}" exceeds max size (${maxBytesPerFile} bytes).`);
        }

        return {
          id: toAttachmentId(),
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          dataBase64: toBase64(await file.arrayBuffer()),
        };
      }),
    );
  }

  async saveRunOutput(options: SaveRunOutputOptions): Promise<SaveRunOutputResult> {
    const runtimeWindow = globalThis as typeof globalThis & FilePickerWindow;
    if (typeof runtimeWindow.showSaveFilePicker !== 'function') {
      return this.webFallback.saveRunOutput(options);
    }

    try {
      const handle = await runtimeWindow.showSaveFilePicker({
        suggestedName: options.suggestedName,
      });
      const writable = await handle.createWritable();
      await writable.write(options.contents);
      await writable.close();

      return {
        saved: true,
        path: handle.name ?? null,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          saved: false,
          path: null,
        };
      }

      throw error;
    }
  }
}
