export type CustomToolVersionSummary = {
  id: string;
  version: string;
  fileCount: number;
  createdAt: number;
};

export type CustomToolSummary = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  latestVersion: CustomToolVersionSummary | null;
};

export type CustomToolFile = {
  id: string;
  originalName: string;
  storedRelPath: string;
  sha256: string;
  sizeBytes: number;
  mime: string | null;
  createdAt: number;
};

export type CustomToolVersion = {
  id: string;
  toolId: string;
  version: string;
  changelogMd: string | null;
  instructionsMd: string;
  createdAt: number;
  files: CustomToolFile[];
};

export type CustomToolDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  versions: CustomToolVersion[];
};

export type CustomToolFileInput = {
  originalName: string;
  mime?: string;
  dataBase64: string;
};

export type CustomToolMetadataInput = {
  name: string;
  slug?: string;
  description: string;
  category: string;
  tags: string[];
};

export type CreateCustomToolInput = {
  metadata: CustomToolMetadataInput;
  version?: string;
  changelogMd?: string;
  instructionsMd: string;
  files: CustomToolFileInput[];
};

export type AddCustomToolVersionInput = {
  toolId: string;
  version: string;
  changelogMd?: string;
  instructionsMd: string;
  files: CustomToolFileInput[];
};

export type CreateCustomToolResult = {
  toolId: string;
  versionId: string;
};

export type ImportZipPayloadInput = {
  fileName: string;
  dataBase64: string;
};

export type ImportZipResult = {
  toolId: string;
  versionId: string;
  createdTool: boolean;
};

export type ImportZipPreviewFile = {
  originalName: string;
  sizeBytes: number;
  sha256: string;
};

export type ImportZipPreview = {
  toolName: string;
  slug: string;
  version: string;
  files: ImportZipPreviewFile[];
  totalSizeBytes: number;
  warnings: string[];
};

export type ExportZipPayload = {
  fileName: string;
  dataBase64: string;
};

export type CustomToolListFilters = {
  query?: string;
  category?: string;
  tag?: string;
};

export interface CustomToolsLibraryService {
  listTools: (filters?: CustomToolListFilters) => Promise<CustomToolSummary[]>;
  getTool: (toolId: string) => Promise<CustomToolDetail>;
  createTool: (input: CreateCustomToolInput) => Promise<CreateCustomToolResult>;
  addToolVersion: (input: AddCustomToolVersionInput) => Promise<CreateCustomToolResult>;
  deleteTool: (toolId: string) => Promise<void>;
  exportToolVersionZipPayload: (toolVersionId: string) => Promise<ExportZipPayload>;
  previewImportZipPayload: (payload: ImportZipPayloadInput) => Promise<ImportZipPreview>;
  importZipPayload: (payload: ImportZipPayloadInput) => Promise<ImportZipResult>;
}
