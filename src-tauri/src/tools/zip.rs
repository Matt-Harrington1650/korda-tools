use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use log::debug;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use uuid::Uuid;

use super::db::{ExportVersionContext, ToolMetadataInput, VersionInsertInput};
use super::error::{ToolsError, ToolsResult};
use super::storage::{
    assert_safe_archive_path, assert_stored_path_matches_version, build_stored_rel_path,
    read_stored_file_bytes, sanitize_filename, sha256_hex, DEFAULT_MAX_FILE_SIZE_BYTES,
    DEFAULT_MAX_VERSION_SIZE_BYTES,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolExportManifest {
    pub tool: ManifestTool,
    pub version: ManifestVersion,
    pub files: Vec<ManifestFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestTool {
    pub name: String,
    pub slug: String,
    pub description: String,
    pub category: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestVersion {
    pub version: String,
    pub changelog_md: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestFile {
    pub original_name: String,
    pub sha256: String,
    pub size_bytes: u64,
    pub relative_path: String,
}

#[derive(Debug, Clone)]
pub struct ParsedImportArchive {
    pub metadata: ToolMetadataInput,
    pub version: VersionInsertInput,
    pub files: Vec<ImportFileBytes>,
}

#[derive(Debug, Clone)]
pub struct ImportFileBytes {
    pub original_name: String,
    pub mime: Option<String>,
    pub bytes: Vec<u8>,
}

pub fn build_manifest(context: &ExportVersionContext) -> ToolsResult<ToolExportManifest> {
    let mut seen_names = HashSet::new();
    let mut files = Vec::with_capacity(context.files.len());

    for file in &context.files {
        let original_name = sanitize_filename(&file.original_name)?;
        if !seen_names.insert(original_name.to_ascii_lowercase()) {
            return Err(ToolsError::Validation(format!(
                "Duplicate file name in version: {}",
                original_name
            )));
        }

        files.push(ManifestFile {
            original_name: original_name.clone(),
            sha256: file.sha256.clone(),
            size_bytes: file.size_bytes.max(0) as u64,
            relative_path: format!("files/{}", original_name),
        });
    }

    Ok(ToolExportManifest {
        tool: ManifestTool {
            name: context.tool.name.clone(),
            slug: context.tool.slug.clone(),
            description: context.tool.description.clone(),
            category: context.tool.category.clone(),
            tags: context.tool.tags.clone(),
        },
        version: ManifestVersion {
            version: context.version.version.clone(),
            changelog_md: context.version.changelog_md.clone(),
        },
        files,
    })
}

pub fn export_tool_version_zip(
    app: &AppHandle,
    context: &ExportVersionContext,
    destination_path: &str,
) -> ToolsResult<()> {
    let destination = normalize_destination(destination_path)?;
    let staging = create_temp_dir("tool-export")?;
    debug!(
        "custom-tools: zip export start tool_id={} version_id={} destination={}",
        context.version.tool_id,
        context.version.id,
        destination.to_string_lossy()
    );

    let result = (|| -> ToolsResult<()> {
        let manifest = build_manifest(context)?;
        let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|error| {
            ToolsError::Zip(format!("Failed to serialize manifest.json: {error}"))
        })?;

        let files_dir = staging.join("files");
        fs::create_dir_all(&files_dir)?;

        fs::write(staging.join("manifest.json"), manifest_json)?;
        fs::write(
            staging.join("instructions.md"),
            context.version.instructions_md.as_bytes(),
        )?;

        for file in &context.files {
            let sanitized = sanitize_filename(&file.original_name)?;
            assert_stored_path_matches_version(
                &file.stored_rel_path,
                &context.version.tool_id,
                &context.version.id,
            )?;
            let expected_rel_path =
                build_stored_rel_path(&context.version.tool_id, &context.version.id, &sanitized)?;
            if file.stored_rel_path != expected_rel_path {
                return Err(ToolsError::Zip(format!(
                    "Stored path mismatch for {}.",
                    sanitized
                )));
            }
            let bytes = read_stored_file_bytes(app, &file.stored_rel_path)?;
            let expected_size = file.size_bytes.max(0) as usize;
            if bytes.len() != expected_size {
                return Err(ToolsError::Zip(format!(
                    "Stored file size mismatch for {}.",
                    sanitized
                )));
            }
            if !sha256_hex(&bytes).eq_ignore_ascii_case(file.sha256.trim()) {
                return Err(ToolsError::Zip(format!(
                    "Stored file hash mismatch for {}.",
                    sanitized
                )));
            }
            fs::write(files_dir.join(sanitized), bytes)?;
        }

        compress_directory_to_zip(&staging, &destination)
    })();

    let _ = fs::remove_dir_all(staging);
    if result.is_ok() {
        debug!(
            "custom-tools: zip export success tool_id={} version_id={}",
            context.version.tool_id, context.version.id
        );
    }
    result
}

pub fn import_tool_zip(zip_path: &str) -> ToolsResult<ParsedImportArchive> {
    let zip_path = PathBuf::from(zip_path.trim());
    if !zip_path.exists() || !zip_path.is_file() {
        return Err(ToolsError::Zip("Import zip path is invalid.".to_string()));
    }
    debug!(
        "custom-tools: zip import start path={}",
        zip_path.to_string_lossy()
    );

    let extraction_dir = create_temp_dir("tool-import")?;
    let result = (|| -> ToolsResult<ParsedImportArchive> {
        extract_zip_safely(&zip_path, &extraction_dir)?;

        let manifest_path = extraction_dir.join("manifest.json");
        let instructions_path = extraction_dir.join("instructions.md");

        let manifest_raw = fs::read_to_string(&manifest_path)
            .map_err(|error| ToolsError::Zip(format!("Failed to read manifest.json: {error}")))?;
        let manifest: ToolExportManifest = serde_json::from_str(&manifest_raw)
            .map_err(|error| ToolsError::Zip(format!("Failed to parse manifest.json: {error}")))?;

        let instructions_md = fs::read_to_string(&instructions_path)
            .map_err(|error| ToolsError::Zip(format!("Failed to read instructions.md: {error}")))?;
        if instructions_md.trim().is_empty() {
            return Err(ToolsError::Validation(
                "instructions.md cannot be empty.".to_string(),
            ));
        }

        let metadata = ToolMetadataInput {
            name: validate_required("tool.name", &manifest.tool.name, 120)?,
            slug: Some(validate_required("tool.slug", &manifest.tool.slug, 120)?),
            description: validate_required("tool.description", &manifest.tool.description, 8_000)?,
            category: validate_required("tool.category", &manifest.tool.category, 120)?,
            tags: manifest.tool.tags,
        };

        let version = VersionInsertInput {
            version: validate_required("version.version", &manifest.version.version, 80)?,
            changelog_md: normalize_optional_text(manifest.version.changelog_md, 512 * 1024)?,
            instructions_md,
        };

        let all_entries = collect_relative_files(&extraction_dir)?;
        let mut expected_paths = HashSet::new();
        expected_paths.insert("manifest.json".to_string());
        expected_paths.insert("instructions.md".to_string());

        let mut parsed_files = Vec::with_capacity(manifest.files.len());
        let mut seen_names = HashSet::new();
        let mut total_size = 0u64;

        for file in manifest.files {
            assert_safe_archive_path(&file.relative_path)?;
            if !file.relative_path.starts_with("files/") {
                return Err(ToolsError::Zip(format!(
                    "Manifest file path must start with files/: {}",
                    file.relative_path
                )));
            }

            let sanitized = sanitize_filename(&file.original_name)?;
            if !seen_names.insert(sanitized.to_ascii_lowercase()) {
                return Err(ToolsError::Validation(format!(
                    "Duplicate file in manifest: {sanitized}"
                )));
            }

            let expected_rel = format!("files/{sanitized}");
            if file.relative_path != expected_rel {
                return Err(ToolsError::Validation(format!(
                    "Manifest relative_path mismatch for {}. Expected {}.",
                    sanitized, expected_rel
                )));
            }
            expected_paths.insert(expected_rel.clone());

            let absolute = extraction_dir.join(&expected_rel);
            if !absolute.exists() {
                return Err(ToolsError::Zip(format!(
                    "Missing archive file: {}",
                    expected_rel
                )));
            }

            let bytes = fs::read(&absolute).map_err(|error| {
                ToolsError::Zip(format!("Failed to read {}: {error}", expected_rel))
            })?;
            let size_bytes = bytes.len() as u64;
            if size_bytes != file.size_bytes {
                return Err(ToolsError::Validation(format!(
                    "File size mismatch for {}. Manifest: {}, archive: {}.",
                    sanitized, file.size_bytes, size_bytes
                )));
            }

            if size_bytes == 0 || size_bytes > DEFAULT_MAX_FILE_SIZE_BYTES {
                return Err(ToolsError::Validation(format!(
                    "{} exceeds allowed size limits.",
                    sanitized
                )));
            }

            total_size += size_bytes;
            if total_size > DEFAULT_MAX_VERSION_SIZE_BYTES {
                return Err(ToolsError::Validation(format!(
                    "Import file total exceeds {} bytes.",
                    DEFAULT_MAX_VERSION_SIZE_BYTES
                )));
            }

            let hash = sha256_hex(&bytes);
            if !hash.eq_ignore_ascii_case(file.sha256.trim()) {
                return Err(ToolsError::Validation(format!(
                    "SHA256 mismatch for {}.",
                    sanitized
                )));
            }

            parsed_files.push(ImportFileBytes {
                original_name: sanitized,
                mime: None,
                bytes,
            });
        }

        for entry in all_entries {
            if !expected_paths.contains(&entry) {
                return Err(ToolsError::Zip(format!(
                    "Unexpected file in archive: {}",
                    entry
                )));
            }
        }

        let parsed = ParsedImportArchive {
            metadata,
            version,
            files: parsed_files,
        };
        debug!(
            "custom-tools: zip import parsed tool_slug={} version={} file_count={}",
            parsed.metadata.slug.clone().unwrap_or_default(),
            parsed.version.version,
            parsed.files.len()
        );
        Ok(parsed)
    })();

    let _ = fs::remove_dir_all(extraction_dir);
    result
}

pub fn import_tool_zip_payload(
    file_name: &str,
    data_base64: &str,
) -> ToolsResult<ParsedImportArchive> {
    debug!(
        "custom-tools: zip payload import start file_name={}",
        file_name.trim()
    );
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64.trim())
        .map_err(|error| {
            ToolsError::Validation(format!("Invalid zip payload encoding: {error}"))
        })?;

    let staging = create_temp_dir("tool-import-payload")?;
    let suggested_name = file_name.trim();
    let zip_file_name = if suggested_name.is_empty() {
        "import.zip".to_string()
    } else {
        let mut sanitized = suggested_name
            .chars()
            .map(|character| {
                if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                    character
                } else {
                    '_'
                }
            })
            .collect::<String>();
        if !sanitized.to_ascii_lowercase().ends_with(".zip") {
            sanitized.push_str(".zip");
        }
        sanitized
    };

    let zip_path = staging.join(zip_file_name);
    fs::write(&zip_path, bytes)?;
    let result = import_tool_zip(zip_path.to_string_lossy().as_ref());
    let _ = fs::remove_dir_all(staging);
    result
}

fn normalize_destination(raw: &str) -> ToolsResult<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(ToolsError::Validation(
            "Destination path is required.".to_string(),
        ));
    }

    let mut destination = PathBuf::from(trimmed);
    if destination.extension().is_none() {
        destination.set_extension("zip");
    }

    if let Some(parent) = destination.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }

    Ok(destination)
}

fn compress_directory_to_zip(source_dir: &Path, destination_zip: &Path) -> ToolsResult<()> {
    let source = ps_quote(source_dir.to_string_lossy().as_ref());
    let destination = ps_quote(destination_zip.to_string_lossy().as_ref());
    let script = format!(
    "$ErrorActionPreference='Stop'; $src={source}; $dest={destination}; if (Test-Path -LiteralPath $dest) {{ Remove-Item -LiteralPath $dest -Force }}; Compress-Archive -Path (Join-Path $src '*') -DestinationPath $dest -CompressionLevel Optimal"
  );

    run_powershell(&script).map(|_| ())
}

fn extract_zip_safely(zip_path: &Path, destination_dir: &Path) -> ToolsResult<()> {
    let zip = ps_quote(zip_path.to_string_lossy().as_ref());
    let destination = ps_quote(destination_dir.to_string_lossy().as_ref());
    let script = format!(
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; $zipPath={zip}; $dest={destination}; if (Test-Path -LiteralPath $dest) {{ Remove-Item -LiteralPath $dest -Recurse -Force }}; New-Item -ItemType Directory -Path $dest | Out-Null; $archive=[System.IO.Compression.ZipFile]::OpenRead($zipPath); try {{ $destRoot=[System.IO.Path]::GetFullPath($dest + [System.IO.Path]::DirectorySeparatorChar); foreach ($entry in $archive.Entries) {{ $name=$entry.FullName; if ([string]::IsNullOrWhiteSpace($name)) {{ throw ('Unsafe zip entry path: ' + $name) }}; if ($name.StartsWith('/') -or $name.StartsWith('\\')) {{ throw ('Unsafe zip entry path: ' + $name) }}; if ($name.Contains('..')) {{ throw ('Unsafe zip entry path: ' + $name) }}; if ($name.Contains(':')) {{ throw ('Unsafe zip entry path: ' + $name) }}; $target=[System.IO.Path]::GetFullPath((Join-Path $dest $name)); if (-not $target.StartsWith($destRoot, [System.StringComparison]::OrdinalIgnoreCase)) {{ throw ('Unsafe zip entry path: ' + $name) }}; if ($name.EndsWith('/') -or $name.EndsWith('\\')) {{ [System.IO.Directory]::CreateDirectory($target) | Out-Null; continue }}; $parent=[System.IO.Path]::GetDirectoryName($target); if ($parent) {{ [System.IO.Directory]::CreateDirectory($parent) | Out-Null }}; [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true) }} }} finally {{ $archive.Dispose() }}"
  );

    run_powershell(&script).map(|_| ())
}

fn collect_relative_files(root: &Path) -> ToolsResult<Vec<String>> {
    let mut entries = Vec::new();
    collect_recursive(root, root, &mut entries)?;
    Ok(entries)
}

fn collect_recursive(root: &Path, current: &Path, entries: &mut Vec<String>) -> ToolsResult<()> {
    for entry in fs::read_dir(current)? {
        let entry = entry.map_err(|error| {
            ToolsError::Zip(format!("Failed to read archive extraction entry: {error}"))
        })?;
        let path = entry.path();

        if path.is_dir() {
            collect_recursive(root, &path, entries)?;
            continue;
        }

        let relative = path
            .strip_prefix(root)
            .map_err(|error| {
                ToolsError::Zip(format!(
                    "Failed to compute relative extraction path: {error}"
                ))
            })?
            .to_string_lossy()
            .replace('\\', "/");

        entries.push(relative);
    }

    Ok(())
}

fn create_temp_dir(prefix: &str) -> ToolsResult<PathBuf> {
    let temp_root = std::env::temp_dir();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| ToolsError::Io(format!("System clock error: {error}")))?
        .as_millis();
    let path = temp_root.join(format!("{prefix}-{now}-{}", Uuid::new_v4()));
    fs::create_dir_all(&path)?;
    Ok(path)
}

fn run_powershell(script: &str) -> ToolsResult<String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .output()
        .map_err(|error| ToolsError::Zip(format!("Failed to execute archive command: {error}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let details = if !stderr.is_empty() { stderr } else { stdout };
        return Err(ToolsError::Zip(if details.is_empty() {
            "Archive command failed.".to_string()
        } else {
            details
        }));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn ps_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn validate_required(field: &str, value: &str, max_len: usize) -> ToolsResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(ToolsError::Validation(format!("{field} is required.")));
    }
    if trimmed.len() > max_len {
        return Err(ToolsError::Validation(format!(
            "{field} exceeds maximum length ({max_len})."
        )));
    }
    Ok(trimmed.to_string())
}

fn normalize_optional_text(value: Option<String>, max_len: usize) -> ToolsResult<Option<String>> {
    let Some(raw) = value else {
        return Ok(None);
    };

    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    if trimmed.len() > max_len {
        return Err(ToolsError::Validation(format!(
            "Text exceeds maximum length ({max_len})."
        )));
    }

    Ok(Some(trimmed.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_manifest_from_export_context() {
        let context = ExportVersionContext {
            tool: super::super::db::ToolMetadataExport {
                name: "CAD Toolset".to_string(),
                slug: "cad-toolset".to_string(),
                description: "CAD helpers".to_string(),
                category: "cad".to_string(),
                tags: vec!["autocad".to_string()],
            },
            version: super::super::db::VersionExport {
                id: "version-1".to_string(),
                tool_id: "tool-1".to_string(),
                version: "1.0.0".to_string(),
                changelog_md: Some("Initial release".to_string()),
                instructions_md: "# install".to_string(),
            },
            files: vec![super::super::db::ToolFileDetail {
                id: "file-1".to_string(),
                original_name: "install.scr".to_string(),
                stored_rel_path: "tools/tool-1/version-1/files/install.scr".to_string(),
                sha256: "abc".to_string(),
                size_bytes: 100,
                mime: None,
                created_at: 0,
            }],
        };

        let manifest = build_manifest(&context).unwrap();
        assert_eq!(manifest.tool.slug, "cad-toolset");
        assert_eq!(manifest.files.len(), 1);
        assert_eq!(manifest.files[0].relative_path, "files/install.scr");
    }

    #[test]
    fn zip_round_trip_preserves_manifest_shape() {
        let root = create_temp_dir("zip-roundtrip").unwrap();
        let staging = root.join("src");
        std::fs::create_dir_all(staging.join("files")).unwrap();

        let manifest = ToolExportManifest {
            tool: ManifestTool {
                name: "CAD Toolset".to_string(),
                slug: "cad-toolset".to_string(),
                description: "CAD helpers".to_string(),
                category: "cad".to_string(),
                tags: vec!["autocad".to_string()],
            },
            version: ManifestVersion {
                version: "1.0.0".to_string(),
                changelog_md: None,
            },
            files: vec![ManifestFile {
                original_name: "install.scr".to_string(),
                sha256: sha256_hex(b"abc"),
                size_bytes: 3,
                relative_path: "files/install.scr".to_string(),
            }],
        };

        std::fs::write(
            staging.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).unwrap(),
        )
        .unwrap();
        std::fs::write(staging.join("instructions.md"), "# install").unwrap();
        std::fs::write(staging.join("files").join("install.scr"), b"abc").unwrap();

        let zip_path = root.join("archive.zip");
        compress_directory_to_zip(&staging, &zip_path).unwrap();

        let extracted = create_temp_dir("zip-roundtrip-extracted").unwrap();
        extract_zip_safely(&zip_path, &extracted).unwrap();

        let parsed: ToolExportManifest = serde_json::from_str(
            &std::fs::read_to_string(extracted.join("manifest.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(parsed.tool.slug, manifest.tool.slug);
        assert_eq!(parsed.version.version, manifest.version.version);
        assert_eq!(parsed.files[0].original_name, "install.scr");

        let _ = std::fs::remove_dir_all(root);
        let _ = std::fs::remove_dir_all(extracted);
    }

    #[test]
    fn manifest_integrity_rejects_sha_mismatch() {
        let root = create_temp_dir("manifest-integrity").unwrap();
        let staging = root.join("src");
        std::fs::create_dir_all(staging.join("files")).unwrap();

        let manifest = ToolExportManifest {
            tool: ManifestTool {
                name: "CAD Toolset".to_string(),
                slug: "cad-toolset".to_string(),
                description: "CAD helpers".to_string(),
                category: "cad".to_string(),
                tags: vec!["autocad".to_string()],
            },
            version: ManifestVersion {
                version: "1.0.0".to_string(),
                changelog_md: None,
            },
            files: vec![ManifestFile {
                original_name: "install.scr".to_string(),
                sha256: "deadbeef".to_string(),
                size_bytes: 3,
                relative_path: "files/install.scr".to_string(),
            }],
        };

        std::fs::write(
            staging.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).unwrap(),
        )
        .unwrap();
        std::fs::write(staging.join("instructions.md"), "# install").unwrap();
        std::fs::write(staging.join("files").join("install.scr"), b"abc").unwrap();

        let zip_path = root.join("archive.zip");
        compress_directory_to_zip(&staging, &zip_path).unwrap();

        let error = import_tool_zip(zip_path.to_string_lossy().as_ref()).unwrap_err();
        assert!(error.user_message().contains("SHA256 mismatch"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn manifest_integrity_rejects_duplicate_file_names() {
        let root = create_temp_dir("manifest-duplicate").unwrap();
        let staging = root.join("src");
        std::fs::create_dir_all(staging.join("files")).unwrap();

        let manifest = ToolExportManifest {
            tool: ManifestTool {
                name: "CAD Toolset".to_string(),
                slug: "cad-toolset".to_string(),
                description: "CAD helpers".to_string(),
                category: "cad".to_string(),
                tags: vec!["autocad".to_string()],
            },
            version: ManifestVersion {
                version: "1.0.0".to_string(),
                changelog_md: None,
            },
            files: vec![
                ManifestFile {
                    original_name: "install.scr".to_string(),
                    sha256: sha256_hex(b"def"),
                    size_bytes: 3,
                    relative_path: "files/install.scr".to_string(),
                },
                ManifestFile {
                    original_name: "install.scr".to_string(),
                    sha256: sha256_hex(b"def"),
                    size_bytes: 3,
                    relative_path: "files/install.scr".to_string(),
                },
            ],
        };

        std::fs::write(
            staging.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).unwrap(),
        )
        .unwrap();
        std::fs::write(staging.join("instructions.md"), "# install").unwrap();
        std::fs::write(staging.join("files").join("install.scr"), b"def").unwrap();

        let zip_path = root.join("archive.zip");
        compress_directory_to_zip(&staging, &zip_path).unwrap();

        let error = import_tool_zip(zip_path.to_string_lossy().as_ref()).unwrap_err();
        assert!(
            error.user_message().contains("Duplicate file in manifest"),
            "unexpected error: {}",
            error.user_message()
        );

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_zip_slip_entries() {
        let malicious_paths = [
            "../evil.txt",
            "..\\evil.txt",
            "C:\\evil.txt",
            "\\\\server\\share\\evil.txt",
            "/absolute/evil.txt",
        ];

        for malicious_path in malicious_paths {
            let root = create_temp_dir("zip-slip").unwrap();
            let zip_path = root.join("payload.zip");
            let manifest_json = serde_json::to_string_pretty(&ToolExportManifest {
                tool: ManifestTool {
                    name: "CAD Toolset".to_string(),
                    slug: "cad-toolset".to_string(),
                    description: "CAD helpers".to_string(),
                    category: "cad".to_string(),
                    tags: vec!["autocad".to_string()],
                },
                version: ManifestVersion {
                    version: "1.0.0".to_string(),
                    changelog_md: None,
                },
                files: vec![ManifestFile {
                    original_name: "install.scr".to_string(),
                    sha256: sha256_hex(b"abc"),
                    size_bytes: 3,
                    relative_path: "files/install.scr".to_string(),
                }],
            })
            .unwrap();
            write_zip_with_entries(
                &zip_path,
                vec![
                    ("manifest.json".to_string(), manifest_json.into_bytes()),
                    ("instructions.md".to_string(), b"# install".to_vec()),
                    ("files/install.scr".to_string(), b"abc".to_vec()),
                    (malicious_path.to_string(), b"boom".to_vec()),
                ],
            );

            let error = import_tool_zip(zip_path.to_string_lossy().as_ref()).unwrap_err();
            assert!(
                error.user_message().contains("Unsafe zip entry path")
                    || error.user_message().contains("Unexpected file in archive")
                    || error
                        .user_message()
                        .contains("Failed to execute archive command")
            );

            let _ = std::fs::remove_dir_all(root);
        }
    }

    #[test]
    fn stress_repeated_import_round_trips() {
        let root = create_temp_dir("zip-stress").unwrap();

        for index in 0..8 {
            let staging = root.join(format!("src-{index}"));
            std::fs::create_dir_all(staging.join("files")).unwrap();

            let bytes = format!("payload-{index}").into_bytes();
            let manifest = ToolExportManifest {
                tool: ManifestTool {
                    name: format!("CAD Toolset {index}"),
                    slug: format!("cad-toolset-{index}"),
                    description: "CAD helpers".to_string(),
                    category: "cad".to_string(),
                    tags: vec!["autocad".to_string()],
                },
                version: ManifestVersion {
                    version: "1.0.0".to_string(),
                    changelog_md: None,
                },
                files: vec![ManifestFile {
                    original_name: "install.scr".to_string(),
                    sha256: sha256_hex(&bytes),
                    size_bytes: bytes.len() as u64,
                    relative_path: "files/install.scr".to_string(),
                }],
            };

            std::fs::write(
                staging.join("manifest.json"),
                serde_json::to_string_pretty(&manifest).unwrap(),
            )
            .unwrap();
            std::fs::write(staging.join("instructions.md"), "# install").unwrap();
            std::fs::write(staging.join("files").join("install.scr"), bytes).unwrap();

            let zip_path = root.join(format!("archive-{index}.zip"));
            compress_directory_to_zip(&staging, &zip_path).unwrap();
            let parsed = import_tool_zip(zip_path.to_string_lossy().as_ref()).unwrap();
            assert_eq!(parsed.files.len(), 1);
            assert_eq!(parsed.version.version, "1.0.0");
        }

        let _ = std::fs::remove_dir_all(root);
    }

    fn write_zip_with_entries(path: &Path, entries: Vec<(String, Vec<u8>)>) {
        let zip_path = ps_quote(path.to_string_lossy().as_ref());
        let entry_objects = entries
            .into_iter()
            .map(|(entry_name, content)| {
                format!(
                    "@{{ Name='{}'; Data='{}' }}",
                    entry_name.replace('\'', "''"),
                    base64::engine::general_purpose::STANDARD.encode(content)
                )
            })
            .collect::<Vec<_>>()
            .join(",");

        let script = format!(
            "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; $zipPath={zip_path}; if (Test-Path -LiteralPath $zipPath) {{ Remove-Item -LiteralPath $zipPath -Force }}; $entries=@({entry_objects}); $archive=[System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create); try {{ foreach ($entry in $entries) {{ $zipEntry=$archive.CreateEntry($entry.Name); $stream=$zipEntry.Open(); try {{ $bytes=[System.Convert]::FromBase64String($entry.Data); $stream.Write($bytes, 0, $bytes.Length) }} finally {{ $stream.Dispose() }} }} }} finally {{ $archive.Dispose() }}"
        );

        run_powershell(&script).unwrap();
    }
}
