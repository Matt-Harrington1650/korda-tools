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
const STORAGE_ROOT_SEGMENT: &str = "tools";
const STORAGE_FILES_SEGMENT: &str = "files";

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
    let normalized_tool_id = validate_storage_segment("tool_id", tool_id)?;
    let normalized_version_id = validate_storage_segment("version_id", version_id)?;

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
        let stored_rel_path =
            build_stored_rel_path(&normalized_tool_id, &normalized_version_id, &sanitized)?;

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
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(ToolsError::Zip("Zip entry has an empty path.".to_string()));
    }

    if trimmed.starts_with('/') || trimmed.starts_with('\\') || trimmed.contains(':') {
        return Err(ToolsError::Zip(format!("Unsafe zip entry path: {trimmed}")));
    }

    if trimmed.contains('\\') {
        return Err(ToolsError::Zip(format!("Unsafe zip entry path: {trimmed}")));
    }

    if trimmed.contains('\0') {
        return Err(ToolsError::Zip(format!("Unsafe zip entry path: {trimmed}")));
    }

    if trimmed.split('/').any(|segment| segment.is_empty() || segment == "." || segment == "..") {
        return Err(ToolsError::Zip(format!("Unsafe zip entry path: {trimmed}")));
    }

    for component in Path::new(trimmed).components() {
        match component {
            Component::Normal(_) => {}
            _ => return Err(ToolsError::Zip(format!("Unsafe zip entry path: {trimmed}"))),
        }
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
    let safe_tool_id = validate_storage_segment("tool_id", tool_id)?;
    let folder = tools_root_dir(app)?.join(safe_tool_id);
    if folder.exists() {
        fs::remove_dir_all(folder)?;
    }
    Ok(())
}

pub fn delete_version_folder(app: &AppHandle, tool_id: &str, version_id: &str) -> ToolsResult<()> {
    let safe_tool_id = validate_storage_segment("tool_id", tool_id)?;
    let safe_version_id = validate_storage_segment("version_id", version_id)?;
    let tool_folder = tools_root_dir(app)?.join(&safe_tool_id);
    let version_folder = tool_folder.join(&safe_version_id);

    if version_folder.exists() {
        fs::remove_dir_all(version_folder)?;
    }

    if tool_folder.exists() && fs::read_dir(&tool_folder)?.next().is_none() {
        fs::remove_dir(tool_folder)?;
    }

    Ok(())
}

pub fn build_stored_rel_path(
    tool_id: &str,
    version_id: &str,
    file_name: &str,
) -> ToolsResult<String> {
    let safe_tool_id = validate_storage_segment("tool_id", tool_id)?;
    let safe_version_id = validate_storage_segment("version_id", version_id)?;
    let safe_file_name = sanitize_filename(file_name)?;

    Ok(format!(
        "{}/{}/{}/{}/{}",
        STORAGE_ROOT_SEGMENT, safe_tool_id, safe_version_id, STORAGE_FILES_SEGMENT, safe_file_name
    ))
}

pub fn assert_stored_path_matches_version(
    stored_rel_path: &str,
    tool_id: &str,
    version_id: &str,
) -> ToolsResult<()> {
    let normalized = normalize_stored_rel_path(stored_rel_path)?;
    let safe_tool_id = validate_storage_segment("tool_id", tool_id)?;
    let safe_version_id = validate_storage_segment("version_id", version_id)?;
    let expected_prefix = format!(
        "{}/{}/{}/{}",
        STORAGE_ROOT_SEGMENT, safe_tool_id, safe_version_id, STORAGE_FILES_SEGMENT
    );

    if !normalized.starts_with(&expected_prefix) {
        return Err(ToolsError::Io(format!(
            "Stored path is outside requested version scope: {}",
            normalized
        )));
    }

    Ok(())
}

pub fn normalize_stored_rel_path(stored_rel_path: &str) -> ToolsResult<String> {
    assert_safe_archive_path(stored_rel_path)?;
    let segments = stored_rel_path.trim().split('/').collect::<Vec<_>>();

    if segments.len() != 5
        || segments[0] != STORAGE_ROOT_SEGMENT
        || segments[3] != STORAGE_FILES_SEGMENT
    {
        return Err(ToolsError::Io(format!(
            "Invalid stored path structure: {}",
            stored_rel_path.trim()
        )));
    }

    let safe_tool_id = validate_storage_segment("tool_id", segments[1])?;
    let safe_version_id = validate_storage_segment("version_id", segments[2])?;
    let safe_file_name = sanitize_filename(segments[4])?;
    if safe_file_name != segments[4] {
        return Err(ToolsError::Io(format!(
            "Stored file name must already be sanitized: {}",
            segments[4]
        )));
    }

    Ok(format!(
        "{}/{}/{}/{}/{}",
        STORAGE_ROOT_SEGMENT, safe_tool_id, safe_version_id, STORAGE_FILES_SEGMENT, safe_file_name
    ))
}

pub fn resolve_stored_path(app: &AppHandle, stored_rel_path: &str) -> ToolsResult<PathBuf> {
    let normalized_rel_path = normalize_stored_rel_path(stored_rel_path)?;

    let mut absolute = app.path().app_data_dir().map_err(|error| {
        ToolsError::Io(format!("Failed to resolve app data directory: {error}"))
    })?;

    for component in Path::new(&normalized_rel_path).components() {
        match component {
            Component::Normal(value) => absolute.push(value),
            _ => {
                return Err(ToolsError::Io(format!(
                    "Unsafe stored path: {normalized_rel_path}"
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

fn validate_storage_segment(label: &str, value: &str) -> ToolsResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(ToolsError::Validation(format!("{label} is required.")));
    }

    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..") || trimmed.contains(':') {
        return Err(ToolsError::Validation(format!(
            "{label} contains unsafe path characters."
        )));
    }

    if !trimmed
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err(ToolsError::Validation(format!(
            "{label} contains unsupported characters."
        )));
    }

    Ok(trimmed.to_string())
}

fn unique_sanitized_filename(
    original_name: &str,
    existing: &mut HashSet<String>,
) -> ToolsResult<String> {
    let sanitized = sanitize_filename(original_name)?;
    if existing.insert(sanitized.to_ascii_lowercase()) {
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

        if existing.insert(trimmed_candidate.to_ascii_lowercase()) {
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
        assert!(assert_safe_archive_path("..\\file.txt").is_err());
        assert!(assert_safe_archive_path("C:\\evil.txt").is_err());
        assert!(assert_safe_archive_path("C:/evil.txt").is_err());
        assert!(assert_safe_archive_path("/absolute/file.txt").is_err());
        assert!(assert_safe_archive_path("\\\\server\\share\\file.txt").is_err());
        assert!(assert_safe_archive_path("files/good/file.txt").is_ok());
    }

    #[test]
    fn normalizes_and_validates_stored_rel_paths() {
        let normalized = normalize_stored_rel_path("tools/tool_1/version_1/files/install.scr").unwrap();
        assert_eq!(normalized, "tools/tool_1/version_1/files/install.scr");

        assert!(normalize_stored_rel_path("tools/tool_1/version_1/files/../evil.scr").is_err());
        assert!(normalize_stored_rel_path("tools/tool_1/version_1/files/not sanitized.SCR").is_err());
        assert!(normalize_stored_rel_path("secrets/tool_1/version_1/files/install.scr").is_err());
    }

    #[test]
    fn deterministic_collision_handling_is_stable() {
        let files = vec![
            InboundToolFile {
                original_name: "My Script.SCR".to_string(),
                mime: Some("text/plain".to_string()),
                data_base64: "YQ==".to_string(),
            },
            InboundToolFile {
                original_name: "My_Script.scr".to_string(),
                mime: Some("text/plain".to_string()),
                data_base64: "Yg==".to_string(),
            },
            InboundToolFile {
                original_name: "my script.scr".to_string(),
                mime: Some("text/plain".to_string()),
                data_base64: "Yw==".to_string(),
            },
        ];

        let staged = stage_inbound_files("tool_1", "version_1", files, &FileLimits::default()).unwrap();
        let names = staged.into_iter().map(|file| file.original_name).collect::<Vec<_>>();
        assert_eq!(
            names,
            vec![
                "My_Script.scr".to_string(),
                "My_Script_2.scr".to_string(),
                "my_script_3.scr".to_string(),
            ]
        );
    }

    #[test]
    fn enforces_file_and_total_size_limits() {
        let file = InboundToolFile {
            original_name: "big.scr".to_string(),
            mime: None,
            data_base64: "YWJj".to_string(),
        };

        let per_file_err = stage_inbound_files(
            "tool_1",
            "version_1",
            vec![file.clone()],
            &FileLimits {
                max_file_size_bytes: 2,
                max_total_size_bytes: 10,
            },
        )
        .unwrap_err();
        assert!(per_file_err
            .user_message()
            .contains("exceeds max size"));

        let total_err = stage_inbound_files(
            "tool_1",
            "version_1",
            vec![file.clone(), file],
            &FileLimits {
                max_file_size_bytes: 10,
                max_total_size_bytes: 5,
            },
        )
        .unwrap_err();
        assert!(total_err
            .user_message()
            .contains("Combined file size exceeds"));
    }
}
