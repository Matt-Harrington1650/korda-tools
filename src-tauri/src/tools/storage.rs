use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};

use base64::Engine;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

use super::error::{ToolsError, ToolsResult};

pub const DEFAULT_MAX_FILE_SIZE_BYTES: u64 = 50 * 1024 * 1024;
pub const DEFAULT_MAX_VERSION_SIZE_BYTES: u64 = 200 * 1024 * 1024;
const MAX_SANITIZED_FILENAME_LEN: usize = 120;

const ALLOWED_EXTENSIONS: &[&str] = &[
    "lsp", "vlx", "fas", "scr", "dwg", "dxf", "cuix", "zip", "pdf", "txt", "md", "json",
];

#[derive(Debug, Clone)]
pub struct FileLimits {
    pub max_file_size_bytes: u64,
    pub max_total_size_bytes: u64,
}

impl Default for FileLimits {
    fn default() -> Self {
        Self {
            max_file_size_bytes: DEFAULT_MAX_FILE_SIZE_BYTES,
            max_total_size_bytes: DEFAULT_MAX_VERSION_SIZE_BYTES,
        }
    }
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InboundToolFile {
    pub original_name: String,
    pub mime: Option<String>,
    pub data_base64: String,
}

#[derive(Debug, Clone)]
pub struct StagedToolFile {
    pub original_name: String,
    pub mime: Option<String>,
    pub bytes: Vec<u8>,
    pub size_bytes: u64,
    pub sha256: String,
    pub stored_rel_path: String,
}

pub fn stage_inbound_files(
    tool_id: &str,
    version_id: &str,
    files: Vec<InboundToolFile>,
    limits: &FileLimits,
) -> ToolsResult<Vec<StagedToolFile>> {
    if files.is_empty() {
        return Err(ToolsError::Validation(
            "At least one file is required.".to_string(),
        ));
    }

    let mut staged = Vec::with_capacity(files.len());
    let mut total_bytes = 0u64;
    let mut used_names = HashSet::new();

    for file in files {
        let sanitized = unique_sanitized_filename(&file.original_name, &mut used_names)?;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(file.data_base64.trim())
            .map_err(|error| {
                ToolsError::Validation(format!(
                    "Invalid base64 file payload for {}: {error}",
                    file.original_name.trim()
                ))
            })?;

        let size_bytes = bytes.len() as u64;
        if size_bytes == 0 {
            return Err(ToolsError::Validation(format!("{} is empty.", sanitized)));
        }
        if size_bytes > limits.max_file_size_bytes {
            return Err(ToolsError::Validation(format!(
                "{} exceeds max size of {} bytes.",
                sanitized, limits.max_file_size_bytes
            )));
        }

        total_bytes += size_bytes;
        if total_bytes > limits.max_total_size_bytes {
            return Err(ToolsError::Validation(format!(
                "Combined file size exceeds {} bytes.",
                limits.max_total_size_bytes
            )));
        }

        let sha256 = sha256_hex(&bytes);
        let stored_rel_path = format!("tools/{tool_id}/{version_id}/files/{sanitized}");

        staged.push(StagedToolFile {
            original_name: sanitized,
            mime: file.mime,
            bytes,
            size_bytes,
            sha256,
            stored_rel_path,
        });
    }

    Ok(staged)
}

pub fn sanitize_filename(original_name: &str) -> ToolsResult<String> {
    let candidate = original_name.trim();
    if candidate.is_empty() {
        return Err(ToolsError::Validation("File name is required.".to_string()));
    }

    if candidate.contains('/') || candidate.contains('\\') || candidate.contains("..") {
        return Err(ToolsError::Validation(
            "File name cannot contain path separators or traversal segments.".to_string(),
        ));
    }

    if candidate.contains(':') {
        return Err(ToolsError::Validation(
            "File name cannot contain drive-prefix separators.".to_string(),
        ));
    }

    let components: Vec<Component<'_>> = Path::new(candidate).components().collect();
    if components.len() != 1 || !matches!(components[0], Component::Normal(_)) {
        return Err(ToolsError::Validation(
            "File name must be a single relative file name.".to_string(),
        ));
    }

    let extension = Path::new(candidate)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| ToolsError::Validation("File extension is required.".to_string()))?;
    if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
        return Err(ToolsError::Validation(format!(
            "Unsupported file extension .{}. Allowed: {}",
            extension,
            ALLOWED_EXTENSIONS
                .iter()
                .map(|item| format!(".{item}"))
                .collect::<Vec<_>>()
                .join(", ")
        )));
    }

    let stem = Path::new(candidate)
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or_else(|| ToolsError::Validation("File name stem is invalid.".to_string()))?;

    let mut sanitized_stem = stem
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else if character.is_whitespace() {
                '_'
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches(['.', ' '])
        .to_string();

    if sanitized_stem.is_empty() {
        sanitized_stem = "file".to_string();
    }

    if is_reserved_windows_name(&sanitized_stem) {
        sanitized_stem.push_str("_file");
    }

    let max_stem_len = MAX_SANITIZED_FILENAME_LEN.saturating_sub(extension.len() + 1);
    if sanitized_stem.len() > max_stem_len {
        sanitized_stem.truncate(max_stem_len.max(1));
    }

    Ok(format!("{sanitized_stem}.{extension}"))
}

pub fn assert_safe_archive_path(path: &str) -> ToolsResult<()> {
    if path.trim().is_empty() {
        return Err(ToolsError::Zip("Zip entry has an empty path.".to_string()));
    }

    if path.starts_with('/') || path.starts_with('\\') || path.contains(':') || path.contains('\\')
    {
        return Err(ToolsError::Zip(format!("Unsafe zip entry path: {path}")));
    }

    for component in Path::new(path).components() {
        match component {
            Component::Normal(_) | Component::CurDir => {}
            _ => return Err(ToolsError::Zip(format!("Unsafe zip entry path: {path}"))),
        }
    }

    if path.split('/').any(|segment| segment == "..") {
        return Err(ToolsError::Zip(format!("Unsafe zip entry path: {path}")));
    }

    Ok(())
}

pub fn tools_root_dir(app: &AppHandle) -> ToolsResult<PathBuf> {
    let app_data_dir = app.path().app_data_dir().map_err(|error| {
        ToolsError::Io(format!("Failed to resolve app data directory: {error}"))
    })?;
    Ok(app_data_dir.join("tools"))
}

pub fn write_staged_files(
    app: &AppHandle,
    staged_files: &[StagedToolFile],
) -> ToolsResult<Vec<PathBuf>> {
    let root = tools_root_dir(app)?;
    let mut written_paths = Vec::with_capacity(staged_files.len());

    for file in staged_files {
        let absolute_path = resolve_stored_path(app, &file.stored_rel_path)?;
        let parent = absolute_path
            .parent()
            .ok_or_else(|| ToolsError::Io("Invalid destination file path.".to_string()))?;
        fs::create_dir_all(parent)?;
        fs::write(&absolute_path, &file.bytes)?;
        written_paths.push(absolute_path);
    }

    if !root.exists() {
        fs::create_dir_all(root)?;
    }

    Ok(written_paths)
}

pub fn remove_written_files(paths: &[PathBuf]) {
    for path in paths {
        let _ = fs::remove_file(path);
    }
}

pub fn delete_tool_folder(app: &AppHandle, tool_id: &str) -> ToolsResult<()> {
    let folder = tools_root_dir(app)?.join(tool_id);
    if folder.exists() {
        fs::remove_dir_all(folder)?;
    }
    Ok(())
}

pub fn resolve_stored_path(app: &AppHandle, stored_rel_path: &str) -> ToolsResult<PathBuf> {
    assert_safe_archive_path(stored_rel_path)?;

    let mut absolute = app.path().app_data_dir().map_err(|error| {
        ToolsError::Io(format!("Failed to resolve app data directory: {error}"))
    })?;

    for component in Path::new(stored_rel_path).components() {
        match component {
            Component::Normal(value) => absolute.push(value),
            Component::CurDir => {}
            _ => {
                return Err(ToolsError::Io(format!(
                    "Unsafe stored path: {stored_rel_path}"
                )))
            }
        }
    }

    Ok(absolute)
}

pub fn read_stored_file_bytes(app: &AppHandle, stored_rel_path: &str) -> ToolsResult<Vec<u8>> {
    let path = resolve_stored_path(app, stored_rel_path)?;
    let bytes = fs::read(path)?;
    Ok(bytes)
}

fn unique_sanitized_filename(
    original_name: &str,
    existing: &mut HashSet<String>,
) -> ToolsResult<String> {
    let sanitized = sanitize_filename(original_name)?;
    if existing.insert(sanitized.clone()) {
        return Ok(sanitized);
    }

    let extension = Path::new(&sanitized)
        .extension()
        .and_then(|value| value.to_str())
        .ok_or_else(|| ToolsError::Validation("File extension is required.".to_string()))?;
    let stem = Path::new(&sanitized)
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or_else(|| ToolsError::Validation("Invalid file name.".to_string()))?;

    let mut suffix = 2usize;
    loop {
        let candidate = format!("{stem}_{suffix}.{extension}");
        let trimmed_candidate = if candidate.len() > MAX_SANITIZED_FILENAME_LEN {
            let max_stem = MAX_SANITIZED_FILENAME_LEN
                .saturating_sub(extension.len() + 2 + suffix.to_string().len());
            format!(
                "{}_{}.{}",
                &stem[..max_stem.max(1).min(stem.len())],
                suffix,
                extension
            )
        } else {
            candidate
        };

        if existing.insert(trimmed_candidate.clone()) {
            return Ok(trimmed_candidate);
        }

        suffix += 1;
    }
}

fn is_reserved_windows_name(stem: &str) -> bool {
    let upper = stem.to_ascii_uppercase();
    matches!(
        upper.as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    )
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_filename_and_enforces_allowlist() {
        let name = sanitize_filename(" My CAD Script.SCR ").unwrap();
        assert_eq!(name, "My_CAD_Script.scr");

        let reserved = sanitize_filename("con.txt").unwrap();
        assert_eq!(reserved, "con_file.txt");

        let invalid = sanitize_filename("payload.exe");
        assert!(invalid.is_err());
    }

    #[test]
    fn rejects_traversal_and_absolute_paths() {
        assert!(assert_safe_archive_path("../file.txt").is_err());
        assert!(assert_safe_archive_path("C:/evil.txt").is_err());
        assert!(assert_safe_archive_path("/root/file.txt").is_err());
        assert!(assert_safe_archive_path("files/good/file.txt").is_ok());
    }
}
