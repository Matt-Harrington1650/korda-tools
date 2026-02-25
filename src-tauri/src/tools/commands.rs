use std::fs;

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use uuid::Uuid;

use super::db::{
    self, FileRecordInsert, ToolDetail, ToolListFilters, ToolMetadataInput, ToolSummary,
    VersionInsertInput,
};
use super::error::{ToolsError, ToolsResult};
use super::storage::{
    self, delete_tool_folder, remove_written_files, sha256_hex, stage_inbound_files,
    write_staged_files, FileLimits, InboundToolFile,
};
use super::zip;

const DEFAULT_INITIAL_VERSION: &str = "1.0.0";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCreateRequest {
    pub metadata: ToolMetadataInput,
    pub version: Option<String>,
    pub changelog_md: Option<String>,
    pub instructions_md: String,
    pub files: Vec<InboundToolFile>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolAddVersionRequest {
    pub tool_id: String,
    pub version: String,
    pub changelog_md: Option<String>,
    pub instructions_md: String,
    pub files: Vec<InboundToolFile>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZipPayloadRequest {
    pub file_name: String,
    pub data_base64: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCreateResult {
    pub tool_id: String,
    pub version_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolImportResult {
    pub tool_id: String,
    pub version_id: String,
    pub created_tool: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportZipPayload {
    pub file_name: String,
    pub data_base64: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolImportPreview {
    pub tool_name: String,
    pub slug: String,
    pub version: String,
    pub files: Vec<ToolImportPreviewFile>,
    pub total_size_bytes: u64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolImportPreviewFile {
    pub original_name: String,
    pub size_bytes: u64,
    pub sha256: String,
}

#[tauri::command]
pub async fn tools_list(
    app: AppHandle,
    query: Option<String>,
    category: Option<String>,
    tag: Option<String>,
) -> Result<Vec<ToolSummary>, String> {
    run(async {
        let pool = db::open_pool(&app).await?;
        db::list_tools(
            &pool,
            ToolListFilters {
                query,
                category,
                tag,
            },
        )
        .await
    })
    .await
}

#[tauri::command]
pub async fn tool_get(app: AppHandle, tool_id: String) -> Result<ToolDetail, String> {
    run(async {
        let pool = db::open_pool(&app).await?;
        db::get_tool_detail(&pool, tool_id.trim()).await
    })
    .await
}

#[tauri::command]
pub async fn tool_create(
    app: AppHandle,
    request: ToolCreateRequest,
) -> Result<ToolCreateResult, String> {
    run(async {
        let pool = db::open_pool(&app).await?;
        let tool_id = Uuid::new_v4().to_string();
        let version_id = Uuid::new_v4().to_string();

        let staged =
            stage_inbound_files(&tool_id, &version_id, request.files, &FileLimits::default())?;
        let written = write_staged_files(&app, &staged)?;
        let file_rows = to_db_file_rows(&staged);

        let db_result = db::create_tool_with_version(
            &pool,
            &tool_id,
            &version_id,
            request.metadata,
            VersionInsertInput {
                version: request.version.unwrap_or_else(|| DEFAULT_INITIAL_VERSION.to_string()),
                changelog_md: request.changelog_md,
                instructions_md: request.instructions_md,
            },
            &file_rows,
        )
        .await;

        if let Err(error) = db_result {
            remove_written_files(&written);
            return Err(error);
        }

        Ok(ToolCreateResult {
            tool_id,
            version_id,
        })
    })
    .await
}

#[tauri::command]
pub async fn tool_add_version(
    app: AppHandle,
    request: ToolAddVersionRequest,
) -> Result<ToolCreateResult, String> {
    run(async {
        let pool = db::open_pool(&app).await?;
        let tool_id = request.tool_id.trim().to_string();
        if tool_id.is_empty() {
            return Err(ToolsError::Validation("tool_id is required.".to_string()));
        }

        let version_id = Uuid::new_v4().to_string();
        let staged =
            stage_inbound_files(&tool_id, &version_id, request.files, &FileLimits::default())?;
        let written = write_staged_files(&app, &staged)?;
        let file_rows = to_db_file_rows(&staged);

        let db_result = db::add_version_with_files(
            &pool,
            &tool_id,
            &version_id,
            VersionInsertInput {
                version: request.version,
                changelog_md: request.changelog_md,
                instructions_md: request.instructions_md,
            },
            &file_rows,
        )
        .await;

        if let Err(error) = db_result {
            remove_written_files(&written);
            return Err(error);
        }

        Ok(ToolCreateResult {
            tool_id,
            version_id,
        })
    })
    .await
}

#[tauri::command]
pub async fn tool_delete(app: AppHandle, tool_id: String) -> Result<(), String> {
    run(async {
        let pool = db::open_pool(&app).await?;
        let trimmed_tool_id = tool_id.trim();
        db::delete_tool(&pool, trimmed_tool_id).await?;
        delete_tool_folder(&app, trimmed_tool_id)
    })
    .await
}

#[tauri::command]
pub async fn tool_export_zip(
    app: AppHandle,
    tool_version_id: String,
    destination_path: String,
) -> Result<(), String> {
    run(async {
        let pool = db::open_pool(&app).await?;
        let context = db::get_export_context(&pool, tool_version_id.trim()).await?;
        zip::export_tool_version_zip(&app, &context, destination_path.trim())
    })
    .await
}

#[tauri::command]
pub async fn tool_export_zip_payload(
    app: AppHandle,
    tool_version_id: String,
) -> Result<ExportZipPayload, String> {
    run(async {
        let pool = db::open_pool(&app).await?;
        let context = db::get_export_context(&pool, tool_version_id.trim()).await?;

        let temp_zip_path = std::env::temp_dir().join(format!("tool-export-{}.zip", Uuid::new_v4()));
        zip::export_tool_version_zip(&app, &context, temp_zip_path.to_string_lossy().as_ref())?;

        let bytes = fs::read(&temp_zip_path)?;
        let _ = fs::remove_file(&temp_zip_path);

        let file_name = format!(
            "{}-{}.zip",
            context.tool.slug,
            context.version.version.replace('.', "_")
        );

        Ok(ExportZipPayload {
            file_name,
            data_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
        })
    })
    .await
}

#[tauri::command]
pub async fn tool_preview_import_zip_payload(
    payload: ZipPayloadRequest,
) -> Result<ToolImportPreview, String> {
    run(async {
        let parsed = zip::import_tool_zip_payload(&payload.file_name, &payload.data_base64)?;
        let slug = parsed
            .metadata
            .slug
            .clone()
            .ok_or_else(|| ToolsError::Validation("Manifest tool.slug is required.".to_string()))?;

        let mut total_size_bytes = 0u64;
        let files = parsed
            .files
            .iter()
            .map(|file| {
                let size_bytes = file.bytes.len() as u64;
                total_size_bytes += size_bytes;
                ToolImportPreviewFile {
                    original_name: file.original_name.clone(),
                    size_bytes,
                    sha256: sha256_hex(&file.bytes),
                }
            })
            .collect::<Vec<_>>();

        Ok(ToolImportPreview {
            tool_name: parsed.metadata.name,
            slug,
            version: parsed.version.version,
            files,
            total_size_bytes,
            warnings: Vec::new(),
        })
    })
    .await
}

#[tauri::command]
pub async fn tool_import_zip_payload(
    app: AppHandle,
    payload: ZipPayloadRequest,
) -> Result<ToolImportResult, String> {
    run(async {
        let parsed = zip::import_tool_zip_payload(&payload.file_name, &payload.data_base64)?;
        import_parsed_archive(&app, parsed).await
    })
    .await
}

#[tauri::command]
pub async fn tool_import_zip(app: AppHandle, zip_path: String) -> Result<ToolImportResult, String> {
    run(async {
        let parsed = zip::import_tool_zip(zip_path.trim())?;
        import_parsed_archive(&app, parsed).await
    })
    .await
}

async fn import_parsed_archive(
    app: &AppHandle,
    parsed: zip::ParsedImportArchive,
) -> ToolsResult<ToolImportResult> {
    let pool = db::open_pool(app).await?;

    let slug = parsed
        .metadata
        .slug
        .clone()
        .ok_or_else(|| ToolsError::Validation("Manifest tool.slug is required.".to_string()))?;

    let existing_tool_id = db::find_tool_id_by_slug(&pool, &slug).await?;
    let (tool_id, version_id, created_tool) = if let Some(tool_id) = existing_tool_id {
        if db::find_version_id(&pool, &tool_id, &parsed.version.version)
            .await?
            .is_some()
        {
            return Err(ToolsError::Conflict(
                "A tool with this slug and version already exists. Import aborted.".to_string(),
            ));
        }

        let version_id = Uuid::new_v4().to_string();
        let staged = stage_inbound_files(
            &tool_id,
            &version_id,
            to_inbound_files(parsed.files),
            &FileLimits::default(),
        )?;
        let written = write_staged_files(app, &staged)?;
        let db_result = db::add_version_with_files(
            &pool,
            &tool_id,
            &version_id,
            parsed.version,
            &to_db_file_rows(&staged),
        )
        .await;

        if let Err(error) = db_result {
            remove_written_files(&written);
            return Err(error);
        }

        (tool_id, version_id, false)
    } else {
        let tool_id = Uuid::new_v4().to_string();
        let version_id = Uuid::new_v4().to_string();
        let staged = stage_inbound_files(
            &tool_id,
            &version_id,
            to_inbound_files(parsed.files),
            &FileLimits::default(),
        )?;
        let written = write_staged_files(app, &staged)?;
        let db_result = db::create_tool_with_version(
            &pool,
            &tool_id,
            &version_id,
            parsed.metadata,
            parsed.version,
            &to_db_file_rows(&staged),
        )
        .await;

        if let Err(error) = db_result {
            remove_written_files(&written);
            return Err(error);
        }

        (tool_id, version_id, true)
    };

    Ok(ToolImportResult {
        tool_id,
        version_id,
        created_tool,
    })
}

fn to_db_file_rows(staged: &[storage::StagedToolFile]) -> Vec<FileRecordInsert> {
    staged
        .iter()
        .map(|file| FileRecordInsert {
            original_name: file.original_name.clone(),
            stored_rel_path: file.stored_rel_path.clone(),
            sha256: file.sha256.clone(),
            size_bytes: file.size_bytes as i64,
            mime: file.mime.clone(),
        })
        .collect()
}

fn to_inbound_files(files: Vec<zip::ImportFileBytes>) -> Vec<InboundToolFile> {
    files
        .into_iter()
        .map(|file| InboundToolFile {
            original_name: file.original_name,
            mime: file.mime,
            data_base64: base64::engine::general_purpose::STANDARD.encode(file.bytes),
        })
        .collect()
}

async fn run<T, F>(future: F) -> Result<T, String>
where
    F: std::future::Future<Output = ToolsResult<T>>,
{
    future.await.map_err(|error| error.user_message())
}
