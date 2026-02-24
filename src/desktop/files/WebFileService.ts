import type { FileService, PickRunFilesOptions, RunAttachment, SaveRunOutputOptions, SaveRunOutputResult } from './FileService';

const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_BYTES_PER_FILE = 2 * 1024 * 1024;

const clampMaxFiles = (value?: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_MAX_FILES;
  }

  return Math.max(1, Math.min(10, Math.trunc(value)));
};

const clampMaxBytesPerFile = (value?: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_MAX_BYTES_PER_FILE;
  }

  return Math.max(1024, Math.min(10 * 1024 * 1024, Math.trunc(value)));
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

const pickBrowserFiles = async (
  options: PickRunFilesOptions,
): Promise<File[]> => {
  return new Promise<File[]>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options.multiple ?? true;

    if (Array.isArray(options.accept) && options.accept.length > 0) {
      input.accept = options.accept.join(',');
    }

    input.addEventListener(
      'change',
      () => {
        const files = input.files ? Array.from(input.files) : [];
        resolve(files);
      },
      { once: true },
    );

    input.click();
  });
};

export class WebFileService implements FileService {
  async pickRunFiles(options: PickRunFilesOptions = {}): Promise<RunAttachment[]> {
    if (typeof document === 'undefined') {
      return [];
    }

    const maxFiles = clampMaxFiles(options.maxFiles);
    const maxBytesPerFile = clampMaxBytesPerFile(options.maxBytesPerFile);
    const files = await pickBrowserFiles(options);
    const selected = files.slice(0, maxFiles);

    return Promise.all(
      selected.map(async (file) => {
        if (file.size > maxBytesPerFile) {
          throw new Error(`File "${file.name}" exceeds max size (${maxBytesPerFile} bytes).`);
        }

        const dataBase64 = toBase64(await file.arrayBuffer());

        return {
          id: toAttachmentId(),
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          dataBase64,
        };
      }),
    );
  }

  async saveRunOutput(options: SaveRunOutputOptions): Promise<SaveRunOutputResult> {
    if (typeof document === 'undefined') {
      return {
        saved: false,
        path: null,
      };
    }

    const blob = new Blob([options.contents], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = objectUrl;
    anchor.download = options.suggestedName || 'run-output.json';
    anchor.click();
    URL.revokeObjectURL(objectUrl);

    return {
      saved: true,
      path: null,
    };
  }
}
