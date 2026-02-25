import { CUSTOM_TOOL_ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES, MAX_TOTAL_VERSION_SIZE_BYTES } from './constants';

export type SelectedToolFile = {
  originalName: string;
  mime: string;
  sizeBytes: number;
  dataBase64: string;
};

type PickerWindow = {
  showOpenFilePicker?: (options?: { multiple?: boolean }) => Promise<Array<{ getFile: () => Promise<File> }>>;
  showSaveFilePicker?: (options?: { suggestedName?: string }) => Promise<{
    name?: string;
    createWritable: () => Promise<{ write: (value: string | Uint8Array) => Promise<void>; close: () => Promise<void> }>;
  }>;
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

const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
};

const ensureAllowedName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('File name is required.');
  }
  const extension = trimmed.split('.').pop()?.toLowerCase();
  if (!extension || !CUSTOM_TOOL_ALLOWED_EXTENSIONS.includes(extension as (typeof CUSTOM_TOOL_ALLOWED_EXTENSIONS)[number])) {
    throw new Error(`File ${trimmed} has an unsupported extension.`);
  }
  return trimmed;
};

const readFilesFromHandles = async (handles: Array<{ getFile: () => Promise<File> }>): Promise<SelectedToolFile[]> => {
  const result: SelectedToolFile[] = [];

  for (const handle of handles) {
    const file = await handle.getFile();
    const originalName = ensureAllowedName(file.name);
    result.push({
      originalName,
      mime: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      dataBase64: toBase64(await file.arrayBuffer()),
    });
  }

  return result;
};

const readFilesFromInput = async (files: FileList): Promise<SelectedToolFile[]> => {
  const result: SelectedToolFile[] = [];
  for (const file of Array.from(files)) {
    const originalName = ensureAllowedName(file.name);
    result.push({
      originalName,
      mime: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      dataBase64: toBase64(await file.arrayBuffer()),
    });
  }

  return result;
};

export const pickToolFiles = async (options: { multiple?: boolean; acceptZipOnly?: boolean } = {}): Promise<SelectedToolFile[]> => {
  const runtimeWindow = globalThis as typeof globalThis & PickerWindow;

  if (typeof runtimeWindow.showOpenFilePicker === 'function') {
    const handles = await runtimeWindow.showOpenFilePicker({
      multiple: options.multiple ?? true,
    });
    const files = await readFilesFromHandles(handles);
    if (options.acceptZipOnly && files.some((file) => !file.originalName.toLowerCase().endsWith('.zip'))) {
      throw new Error('Please select a .zip file.');
    }
    return files;
  }

  return new Promise<SelectedToolFile[]>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options.multiple ?? true;
    input.accept = options.acceptZipOnly ? '.zip' : CUSTOM_TOOL_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

    input.onchange = async () => {
      const selected = input.files;
      if (!selected || selected.length === 0) {
        resolve([]);
        return;
      }

      try {
        const files = await readFilesFromInput(selected);
        if (options.acceptZipOnly && files.some((file) => !file.originalName.toLowerCase().endsWith('.zip'))) {
          reject(new Error('Please select a .zip file.'));
          return;
        }
        resolve(files);
      } catch (error) {
        reject(error);
      }
    };

    input.click();
  });
};

export const saveZipFromBase64 = async (payload: { fileName: string; dataBase64: string }): Promise<void> => {
  const bytes = fromBase64(payload.dataBase64);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const runtimeWindow = globalThis as typeof globalThis & PickerWindow;

  if (typeof runtimeWindow.showSaveFilePicker === 'function') {
    const handle = await runtimeWindow.showSaveFilePicker({
      suggestedName: payload.fileName,
    });
    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();
    return;
  }

  const blob = new Blob([buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = payload.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const slugify = (value: string): string => {
  const lowered = value.toLowerCase();
  let output = '';
  let previousDash = false;

  for (const character of lowered) {
    if ((character >= 'a' && character <= 'z') || (character >= '0' && character <= '9')) {
      output += character;
      previousDash = false;
      continue;
    }

    if (!previousDash) {
      output += '-';
      previousDash = true;
    }
  }

  output = output.replace(/^-+|-+$/g, '');
  return output || 'tool';
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

export const validateFileSelection = (files: SelectedToolFile[]): string[] => {
  const errors: string[] = [];

  if (files.length === 0) {
    errors.push('Attach at least one file.');
    return errors;
  }

  let totalBytes = 0;
  const usedNames = new Set<string>();

  files.forEach((file) => {
    if (file.sizeBytes === 0) {
      errors.push(`${file.originalName} is empty.`);
    }

    if (file.sizeBytes > MAX_FILE_SIZE_BYTES) {
      errors.push(`${file.originalName} exceeds ${formatBytes(MAX_FILE_SIZE_BYTES)}.`);
    }

    const lowered = file.originalName.toLowerCase();
    if (usedNames.has(lowered)) {
      errors.push(`Duplicate file name: ${file.originalName}`);
    }
    usedNames.add(lowered);

    totalBytes += file.sizeBytes;
  });

  if (totalBytes > MAX_TOTAL_VERSION_SIZE_BYTES) {
    errors.push(`Combined file size exceeds ${formatBytes(MAX_TOTAL_VERSION_SIZE_BYTES)}.`);
  }

  return errors;
};
