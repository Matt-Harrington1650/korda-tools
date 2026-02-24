export type RunAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataBase64: string;
};

export type PickRunFilesOptions = {
  multiple?: boolean;
  maxFiles?: number;
  maxBytesPerFile?: number;
  accept?: string[];
};

export type SaveRunOutputOptions = {
  suggestedName: string;
  contents: string;
};

export type SaveRunOutputResult = {
  saved: boolean;
  path: string | null;
};

export interface FileService {
  pickRunFiles: (options?: PickRunFilesOptions) => Promise<RunAttachment[]>;
  saveRunOutput: (options: SaveRunOutputOptions) => Promise<SaveRunOutputResult>;
}
