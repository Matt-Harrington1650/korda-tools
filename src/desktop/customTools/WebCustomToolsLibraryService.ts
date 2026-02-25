import type {
  AddCustomToolVersionInput,
  CreateCustomToolInput,
  CreateCustomToolResult,
  CustomToolDetail,
  CustomToolListFilters,
  CustomToolSummary,
  CustomToolsLibraryService,
  ExportZipPayload,
  ImportZipPayloadInput,
  ImportZipPreview,
  ImportZipResult,
} from './CustomToolsLibraryService';

const unsupported = (): never => {
  throw new Error('Custom Tools Library requires Tauri desktop runtime.');
};

export class WebCustomToolsLibraryService implements CustomToolsLibraryService {
  listTools(_filters?: CustomToolListFilters): Promise<CustomToolSummary[]> {
    return Promise.resolve(unsupported());
  }

  getTool(_toolId: string): Promise<CustomToolDetail> {
    return Promise.resolve(unsupported());
  }

  createTool(_input: CreateCustomToolInput): Promise<CreateCustomToolResult> {
    return Promise.resolve(unsupported());
  }

  addToolVersion(_input: AddCustomToolVersionInput): Promise<CreateCustomToolResult> {
    return Promise.resolve(unsupported());
  }

  deleteTool(_toolId: string): Promise<void> {
    return Promise.resolve(unsupported());
  }

  exportToolVersionZipPayload(_toolVersionId: string): Promise<ExportZipPayload> {
    return Promise.resolve(unsupported());
  }

  previewImportZipPayload(_payload: ImportZipPayloadInput): Promise<ImportZipPreview> {
    return Promise.resolve(unsupported());
  }

  importZipPayload(_payload: ImportZipPayloadInput): Promise<ImportZipResult> {
    return Promise.resolve(unsupported());
  }
}
