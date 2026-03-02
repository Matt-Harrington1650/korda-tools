use std::fs;
use std::path::{Component, Path, PathBuf};

use tauri::{AppHandle, Manager};
use uuid::Uuid;

const OBJECT_STORE_ROOT: &str = "object_store";

fn resolve_base_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app_data_dir: {error}"))?;
    let base_dir = app_data_dir.join(OBJECT_STORE_ROOT);

    fs::create_dir_all(&base_dir)
        .map_err(|error| format!("failed to create object store base directory: {error}"))?;

    Ok(base_dir)
}

fn sanitize_relative_path(raw_path: &str) -> Result<PathBuf, String> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err("path is required".to_string());
    }

    let mut sanitized = PathBuf::new();
    for component in Path::new(trimmed).components() {
        match component {
            Component::Normal(segment) => sanitized.push(segment),
            Component::CurDir => {}
            _ => {
                return Err(
                    "invalid path segment: absolute, parent, and prefix components are not allowed"
                        .to_string(),
                )
            }
        }
    }

    if sanitized.as_os_str().is_empty() {
        return Err("path must contain at least one normal segment".to_string());
    }

    Ok(sanitized)
}

fn resolve_target_path(app: &AppHandle, raw_path: &str) -> Result<PathBuf, String> {
    let base = resolve_base_dir(app)?;
    let relative = sanitize_relative_path(raw_path)?;
    Ok(base.join(relative))
}

#[tauri::command]
pub async fn object_store_exists(app: AppHandle, path: String) -> Result<bool, String> {
    let target = resolve_target_path(&app, &path)?;
    Ok(target.exists())
}

#[tauri::command]
pub async fn object_store_mkdirp(app: AppHandle, path: String) -> Result<(), String> {
    let target = resolve_target_path(&app, &path)?;
    fs::create_dir_all(target).map_err(|error| format!("failed to create object store directory: {error}"))
}

#[tauri::command]
pub async fn object_store_write_file_atomic(
    app: AppHandle,
    path: String,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let target = resolve_target_path(&app, &path)?;
    if target.exists() {
        return Ok(());
    }

    let parent = target
        .parent()
        .ok_or_else(|| "target path parent is missing".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("failed to create target parent directory: {error}"))?;

    let temp_path = parent.join(format!(".{}.tmp", Uuid::new_v4()));
    fs::write(&temp_path, &bytes).map_err(|error| format!("failed to write temp object file: {error}"))?;

    match fs::rename(&temp_path, &target) {
        Ok(_) => Ok(()),
        Err(error) => {
            if target.exists() {
                let _ = fs::remove_file(&temp_path);
                return Ok(());
            }

            let _ = fs::remove_file(&temp_path);
            Err(format!("failed to atomically rename temp object file: {error}"))
        }
    }
}

#[tauri::command]
pub async fn object_store_read_file(app: AppHandle, path: String) -> Result<Vec<u8>, String> {
    let target = resolve_target_path(&app, &path)?;
    fs::read(target).map_err(|error| format!("failed to read object file: {error}"))
}
