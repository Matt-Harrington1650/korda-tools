use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use super::error::{ToolsError, ToolsResult};

pub const DB_FILE_NAME: &str = "korda_tools.db";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolMetadataInput {
    pub name: String,
    pub slug: Option<String>,
    pub description: String,
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolListFilters {
    pub query: Option<String>,
    pub category: Option<String>,
    pub tag: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolSummary {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub description: String,
    pub category: String,
    pub tags: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub latest_version: Option<VersionSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionSummary {
    pub id: String,
    pub version: String,
    pub file_count: usize,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolFileDetail {
    pub id: String,
    pub original_name: String,
    pub stored_rel_path: String,
    pub sha256: String,
    pub size_bytes: i64,
    pub mime: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolVersionDetail {
    pub id: String,
    pub tool_id: String,
    pub version: String,
    pub changelog_md: Option<String>,
    pub instructions_md: String,
    pub created_at: i64,
    pub files: Vec<ToolFileDetail>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDetail {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub description: String,
    pub category: String,
    pub tags: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub versions: Vec<ToolVersionDetail>,
}

#[derive(Debug, Clone)]
pub struct VersionInsertInput {
    pub version: String,
    pub changelog_md: Option<String>,
    pub instructions_md: String,
}

#[derive(Debug, Clone)]
pub struct FileRecordInsert {
    pub original_name: String,
    pub stored_rel_path: String,
    pub sha256: String,
    pub size_bytes: i64,
    pub mime: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ExportVersionContext {
    pub tool: ToolMetadataExport,
    pub version: VersionExport,
    pub files: Vec<ToolFileDetail>,
}

#[derive(Debug, Clone)]
pub struct ToolMetadataExport {
    pub name: String,
    pub slug: String,
    pub description: String,
    pub category: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct VersionExport {
    pub version: String,
    pub changelog_md: Option<String>,
    pub instructions_md: String,
}

pub async fn open_pool(app: &AppHandle) -> ToolsResult<SqlitePool> {
    let app_config_dir = app.path().app_config_dir().map_err(|error| {
        ToolsError::Io(format!("Failed to resolve app config directory: {error}"))
    })?;
    std::fs::create_dir_all(&app_config_dir)?;

    let db_path = app_config_dir.join(DB_FILE_NAME);
    let db_url = format!("sqlite:{}", db_path.to_string_lossy());
    let pool = SqlitePool::connect(&db_url).await.map_err(|error| {
        ToolsError::Database(format!("Failed to open SQLite database: {error}"))
    })?;

    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await?;
    execute_batch(
        &pool,
        include_str!("../../migrations/0012_create_custom_tool_library.sql"),
    )
    .await?;
    execute_batch(
        &pool,
        include_str!("../../migrations/0013_harden_custom_tool_library.sql"),
    )
    .await?;

    Ok(pool)
}

pub async fn list_tools(
    pool: &SqlitePool,
    filters: ToolListFilters,
) -> ToolsResult<Vec<ToolSummary>> {
    let rows = sqlx::query(
        "SELECT id, name, slug, description, category, created_at, updated_at
      FROM custom_library_tools
      ORDER BY updated_at DESC, name COLLATE NOCASE ASC",
    )
    .fetch_all(pool)
    .await?;

    let mut summaries = Vec::with_capacity(rows.len());
    for row in rows {
        let tool_id: String = row.get("id");
        let tags = fetch_tags(pool, &tool_id).await?;
        let latest_version = fetch_latest_version(pool, &tool_id).await?;

        let summary = ToolSummary {
            id: tool_id,
            name: row.get("name"),
            slug: row.get("slug"),
            description: row.get("description"),
            category: row.get("category"),
            tags,
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            latest_version,
        };

        if matches_filters(&summary, &filters) {
            summaries.push(summary);
        }
    }

    Ok(summaries)
}

pub async fn get_tool_detail(pool: &SqlitePool, tool_id: &str) -> ToolsResult<ToolDetail> {
    let row = sqlx::query(
        "SELECT id, name, slug, description, category, created_at, updated_at
      FROM custom_library_tools
      WHERE id = ?1",
    )
    .bind(tool_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ToolsError::NotFound("Tool not found.".to_string()))?;

    let tags = fetch_tags(pool, tool_id).await?;

    let version_rows = sqlx::query(
        "SELECT id
      FROM custom_library_tool_versions
      WHERE tool_id = ?1
      ORDER BY created_at DESC",
    )
    .bind(tool_id)
    .fetch_all(pool)
    .await?;

    let mut versions = Vec::with_capacity(version_rows.len());
    for version_row in version_rows {
        let version_id: String = version_row.get("id");
        versions.push(get_version_detail(pool, &version_id).await?);
    }

    Ok(ToolDetail {
        id: row.get("id"),
        name: row.get("name"),
        slug: row.get("slug"),
        description: row.get("description"),
        category: row.get("category"),
        tags,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        versions,
    })
}

pub async fn create_tool_with_version(
    pool: &SqlitePool,
    tool_id: &str,
    version_id: &str,
    metadata: ToolMetadataInput,
    version: VersionInsertInput,
    files: &[FileRecordInsert],
) -> ToolsResult<(String, String)> {
    let now = now_epoch_millis()?;
    let name = validate_required("name", &metadata.name, 120)?;
    let description = validate_required("description", &metadata.description, 8_000)?;
    let category = validate_required("category", &metadata.category, 120)?;
    let normalized_tags = normalize_tags(&metadata.tags)?;
    let requested_slug = metadata
        .slug
        .as_ref()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| slugify(&name));
    let slug = resolve_unique_slug(pool, &requested_slug, None).await?;
    let version_label = validate_required("version", &version.version, 80)?;
    let instructions = validate_required("instructions", &version.instructions_md, 512 * 1024)?;
    let changelog = normalize_optional_text(version.changelog_md, 512 * 1024)?;

    let mut tx = pool.begin().await?;
    sqlx::query(
    "INSERT INTO custom_library_tools (id, name, slug, description, category, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
  )
  .bind(tool_id)
  .bind(&name)
  .bind(&slug)
  .bind(&description)
  .bind(&category)
  .bind(now)
  .bind(now)
  .execute(&mut *tx)
  .await?;

    for tag in normalized_tags {
        sqlx::query("INSERT INTO custom_library_tool_tags (tool_id, tag) VALUES (?1, ?2)")
            .bind(tool_id)
            .bind(tag)
            .execute(&mut *tx)
            .await?;
    }

    sqlx::query(
    "INSERT INTO custom_library_tool_versions (id, tool_id, version, changelog_md, instructions_md, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
  )
  .bind(version_id)
  .bind(tool_id)
  .bind(&version_label)
  .bind(changelog)
  .bind(&instructions)
  .bind(now)
  .execute(&mut *tx)
  .await?;

    insert_files(&mut tx, version_id, files, now).await?;

    tx.commit().await?;
    Ok((tool_id.to_string(), version_id.to_string()))
}

pub async fn add_version_with_files(
    pool: &SqlitePool,
    tool_id: &str,
    version_id: &str,
    version: VersionInsertInput,
    files: &[FileRecordInsert],
) -> ToolsResult<String> {
    let now = now_epoch_millis()?;

    let tool_exists = sqlx::query("SELECT 1 FROM custom_library_tools WHERE id = ?1")
        .bind(tool_id)
        .fetch_optional(pool)
        .await?
        .is_some();
    if !tool_exists {
        return Err(ToolsError::NotFound("Tool not found.".to_string()));
    }

    let version_label = validate_required("version", &version.version, 80)?;
    let instructions = validate_required("instructions", &version.instructions_md, 512 * 1024)?;
    let changelog = normalize_optional_text(version.changelog_md, 512 * 1024)?;

    let existing_version = find_version_id(pool, tool_id, &version_label).await?;
    if existing_version.is_some() {
        return Err(ToolsError::Conflict(
            "Version already exists for this tool.".to_string(),
        ));
    }

    let mut tx = pool.begin().await?;

    sqlx::query(
    "INSERT INTO custom_library_tool_versions (id, tool_id, version, changelog_md, instructions_md, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
  )
  .bind(version_id)
  .bind(tool_id)
  .bind(&version_label)
  .bind(changelog)
  .bind(&instructions)
  .bind(now)
  .execute(&mut *tx)
  .await?;

    insert_files(&mut tx, version_id, files, now).await?;

    sqlx::query("UPDATE custom_library_tools SET updated_at = ?2 WHERE id = ?1")
        .bind(tool_id)
        .bind(now)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(version_id.to_string())
}

pub async fn delete_tool(pool: &SqlitePool, tool_id: &str) -> ToolsResult<()> {
    let result = sqlx::query("DELETE FROM custom_library_tools WHERE id = ?1")
        .bind(tool_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ToolsError::NotFound("Tool not found.".to_string()));
    }

    Ok(())
}

pub async fn find_tool_id_by_slug(pool: &SqlitePool, slug: &str) -> ToolsResult<Option<String>> {
    let row = sqlx::query("SELECT id FROM custom_library_tools WHERE slug = ?1")
        .bind(slug)
        .fetch_optional(pool)
        .await?;

    Ok(row.map(|value| value.get("id")))
}

pub async fn find_version_id(
    pool: &SqlitePool,
    tool_id: &str,
    version: &str,
) -> ToolsResult<Option<String>> {
    let row = sqlx::query(
        "SELECT id FROM custom_library_tool_versions WHERE tool_id = ?1 AND version = ?2",
    )
    .bind(tool_id)
    .bind(version)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|value| value.get("id")))
}

pub async fn get_export_context(
    pool: &SqlitePool,
    version_id: &str,
) -> ToolsResult<ExportVersionContext> {
    let version_row = sqlx::query(
        "SELECT v.id as version_id, v.tool_id, v.version, v.changelog_md, v.instructions_md,
            t.name, t.slug, t.description, t.category
      FROM custom_library_tool_versions v
      INNER JOIN custom_library_tools t ON t.id = v.tool_id
      WHERE v.id = ?1",
    )
    .bind(version_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ToolsError::NotFound("Tool version not found.".to_string()))?;

    let tool_id: String = version_row.get("tool_id");
    let tags = fetch_tags(pool, &tool_id).await?;
    let files = fetch_files_for_version(pool, version_id).await?;

    Ok(ExportVersionContext {
        tool: ToolMetadataExport {
            name: version_row.get("name"),
            slug: version_row.get("slug"),
            description: version_row.get("description"),
            category: version_row.get("category"),
            tags,
        },
        version: VersionExport {
            version: version_row.get("version"),
            changelog_md: version_row.get("changelog_md"),
            instructions_md: version_row.get("instructions_md"),
        },
        files,
    })
}

async fn insert_files(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    version_id: &str,
    files: &[FileRecordInsert],
    created_at: i64,
) -> ToolsResult<()> {
    for file in files {
        let file_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO custom_library_tool_files
        (id, tool_version_id, original_name, stored_rel_path, sha256, size_bytes, mime, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        )
        .bind(file_id)
        .bind(version_id)
        .bind(&file.original_name)
        .bind(&file.stored_rel_path)
        .bind(&file.sha256)
        .bind(file.size_bytes)
        .bind(&file.mime)
        .bind(created_at)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

async fn get_version_detail(pool: &SqlitePool, version_id: &str) -> ToolsResult<ToolVersionDetail> {
    let row = sqlx::query(
        "SELECT id, tool_id, version, changelog_md, instructions_md, created_at
      FROM custom_library_tool_versions
      WHERE id = ?1",
    )
    .bind(version_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ToolsError::NotFound("Tool version not found.".to_string()))?;

    let files = fetch_files_for_version(pool, version_id).await?;

    Ok(ToolVersionDetail {
        id: row.get("id"),
        tool_id: row.get("tool_id"),
        version: row.get("version"),
        changelog_md: row.get("changelog_md"),
        instructions_md: row.get("instructions_md"),
        created_at: row.get("created_at"),
        files,
    })
}

async fn fetch_files_for_version(
    pool: &SqlitePool,
    version_id: &str,
) -> ToolsResult<Vec<ToolFileDetail>> {
    let rows = sqlx::query(
        "SELECT id, original_name, stored_rel_path, sha256, size_bytes, mime, created_at
      FROM custom_library_tool_files
      WHERE tool_version_id = ?1
      ORDER BY original_name COLLATE NOCASE ASC",
    )
    .bind(version_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| ToolFileDetail {
            id: row.get("id"),
            original_name: row.get("original_name"),
            stored_rel_path: row.get("stored_rel_path"),
            sha256: row.get("sha256"),
            size_bytes: row.get("size_bytes"),
            mime: row.get("mime"),
            created_at: row.get("created_at"),
        })
        .collect())
}

async fn fetch_tags(pool: &SqlitePool, tool_id: &str) -> ToolsResult<Vec<String>> {
    let rows = sqlx::query(
        "SELECT tag
      FROM custom_library_tool_tags
      WHERE tool_id = ?1
      ORDER BY tag COLLATE NOCASE ASC",
    )
    .bind(tool_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| row.get::<String, _>("tag"))
        .collect())
}

async fn fetch_latest_version(
    pool: &SqlitePool,
    tool_id: &str,
) -> ToolsResult<Option<VersionSummary>> {
    let row = sqlx::query(
        "SELECT id, version, created_at
      FROM custom_library_tool_versions
      WHERE tool_id = ?1
      ORDER BY created_at DESC
      LIMIT 1",
    )
    .bind(tool_id)
    .fetch_optional(pool)
    .await?;

    let Some(row) = row else {
        return Ok(None);
    };

    let version_id: String = row.get("id");
    let file_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM custom_library_tool_files WHERE tool_version_id = ?1",
    )
    .bind(&version_id)
    .fetch_one(pool)
    .await?;

    Ok(Some(VersionSummary {
        id: version_id,
        version: row.get("version"),
        file_count: file_count as usize,
        created_at: row.get("created_at"),
    }))
}

fn matches_filters(tool: &ToolSummary, filters: &ToolListFilters) -> bool {
    let category_match = filters
        .category
        .as_ref()
        .map(|category| {
            category.trim().is_empty() || tool.category.eq_ignore_ascii_case(category.trim())
        })
        .unwrap_or(true);
    if !category_match {
        return false;
    }

    let tag_match = filters
        .tag
        .as_ref()
        .map(|tag| {
            let needle = tag.trim().to_ascii_lowercase();
            needle.is_empty()
                || tool
                    .tags
                    .iter()
                    .any(|value| value.to_ascii_lowercase() == needle)
        })
        .unwrap_or(true);
    if !tag_match {
        return false;
    }

    filters
        .query
        .as_ref()
        .map(|query| {
            let needle = query.trim().to_ascii_lowercase();
            if needle.is_empty() {
                return true;
            }

            let mut haystack = vec![
                tool.name.to_ascii_lowercase(),
                tool.slug.to_ascii_lowercase(),
                tool.description.to_ascii_lowercase(),
                tool.category.to_ascii_lowercase(),
            ];
            haystack.extend(tool.tags.iter().map(|tag| tag.to_ascii_lowercase()));
            if let Some(version) = &tool.latest_version {
                haystack.push(version.version.to_ascii_lowercase());
            }

            haystack.iter().any(|value| value.contains(&needle))
        })
        .unwrap_or(true)
}

async fn execute_batch(pool: &SqlitePool, sql_batch: &str) -> ToolsResult<()> {
    for statement in sql_batch.split(';') {
        let sql = statement.trim();
        if sql.is_empty() {
            continue;
        }

        sqlx::query(sql).execute(pool).await?;
    }

    Ok(())
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

fn normalize_tags(tags: &[String]) -> ToolsResult<Vec<String>> {
    let mut seen = std::collections::HashSet::new();
    let mut normalized = Vec::new();

    for raw in tags {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.len() > 48 {
            return Err(ToolsError::Validation(
                "Tag exceeds 48 characters.".to_string(),
            ));
        }

        let lowered = trimmed.to_ascii_lowercase();
        if seen.insert(lowered) {
            normalized.push(trimmed.to_string());
        }
    }

    normalized.sort_by(|left, right| left.to_ascii_lowercase().cmp(&right.to_ascii_lowercase()));
    Ok(normalized)
}

fn slugify(value: &str) -> String {
    let lowered = value.to_ascii_lowercase();
    let mut slug = String::with_capacity(lowered.len());
    let mut previous_dash = false;

    for character in lowered.chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character);
            previous_dash = false;
            continue;
        }

        if !previous_dash {
            slug.push('-');
            previous_dash = true;
        }
    }

    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() {
        "tool".to_string()
    } else {
        slug
    }
}

async fn resolve_unique_slug(
    pool: &SqlitePool,
    requested_slug: &str,
    exclude_tool_id: Option<&str>,
) -> ToolsResult<String> {
    let base = slugify(requested_slug);
    let mut candidate = base.clone();
    let mut counter = 2usize;

    loop {
        let exists = if let Some(exclude_id) = exclude_tool_id {
            sqlx::query("SELECT 1 FROM custom_library_tools WHERE slug = ?1 AND id <> ?2")
                .bind(&candidate)
                .bind(exclude_id)
                .fetch_optional(pool)
                .await?
                .is_some()
        } else {
            sqlx::query("SELECT 1 FROM custom_library_tools WHERE slug = ?1")
                .bind(&candidate)
                .fetch_optional(pool)
                .await?
                .is_some()
        };

        if !exists {
            return Ok(candidate);
        }

        candidate = format!("{base}-{counter}");
        counter += 1;
    }
}

fn now_epoch_millis() -> ToolsResult<i64> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| ToolsError::Io(format!("System clock error: {error}")))?;
    Ok(duration.as_millis() as i64)
}
