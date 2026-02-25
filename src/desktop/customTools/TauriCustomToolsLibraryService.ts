import { tauriInvoke } from '../../lib/tauri';
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

export class TauriCustomToolsLibraryService implements CustomToolsLibraryService {
  listTools(filters: CustomToolListFilters = {}): Promise<CustomToolSummary[]> {
    return tauriInvoke<CustomToolSummary[]>('tools_list', {
      query: filters.query,
      category: filters.category,
      tag: filters.tag,
    });
  }

  getTool(toolId: string): Promise<CustomToolDetail> {
    return tauriInvoke<CustomToolDetail>('tool_get', {
      tool_id: toolId,
    });
  }

  createTool(input: CreateCustomToolInput): Promise<CreateCustomToolResult> {
    return tauriInvoke<CreateCustomToolResult>('tool_create', {
      request: input,
    });
  }

  addToolVersion(input: AddCustomToolVersionInput): Promise<CreateCustomToolResult> {
    return tauriInvoke<CreateCustomToolResult>('tool_add_version', {
      request: input,
    });
  }

  deleteTool(toolId: string): Promise<void> {
    return tauriInvoke<void>('tool_delete', {
      tool_id: toolId,
    });
  }

  exportToolVersionZipPayload(toolVersionId: string): Promise<ExportZipPayload> {
    return tauriInvoke<ExportZipPayload>('tool_export_zip_payload', {
      tool_version_id: toolVersionId,
    });
  }

  previewImportZipPayload(payload: ImportZipPayloadInput): Promise<ImportZipPreview> {
    return tauriInvoke<ImportZipPreview>('tool_preview_import_zip_payload', {
      payload,
    });
  }

  importZipPayload(payload: ImportZipPayloadInput): Promise<ImportZipResult> {
    return tauriInvoke<ImportZipResult>('tool_import_zip_payload', {
      payload,
    });
  }
}
