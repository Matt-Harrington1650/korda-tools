use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use tauri::AppHandle;

use super::error::{HelpError, HelpResult};

const BUILTIN_WELCOME_KEY: &str = "welcome_dismissed";
const BUILTIN_DEVELOPER_MODE_KEY: &str = "developer_mode";

struct BuiltinPageSeed {
    id: &'static str,
    slug: &'static str,
    title: &'static str,
    category: &'static str,
    sort_order: i64,
    content_md: &'static str,
}

const BUILTIN_HELP_PAGES: &[BuiltinPageSeed] = &[
    BuiltinPageSeed {
        id: "47ab5369-0f89-4f1d-b1eb-740f2f5928d5",
        slug: "introduction",
        title: "Introduction",
        category: "Getting Started",
        sort_order: 10,
        content_md: include_str!("content/introduction.md"),
    },
    BuiltinPageSeed {
        id: "06e7905d-4cf7-476f-af53-8788f53ddfe9",
        slug: "quick-start",
        title: "Quick Start",
        category: "Getting Started",
        sort_order: 20,
        content_md: include_str!("content/quick-start.md"),
    },
    BuiltinPageSeed {
        id: "6d22fa49-1812-4f10-b8f7-9d5f4f8f4bce",
        slug: "workflows-overview",
        title: "Workflows Overview",
        category: "Workflows",
        sort_order: 30,
        content_md: include_str!("content/workflows-overview.md"),
    },
    BuiltinPageSeed {
        id: "b95bf287-68ad-42b6-93f7-91d59e5d206f",
        slug: "tools-library",
        title: "Tools Library",
        category: "Tools",
        sort_order: 40,
        content_md: include_str!("content/tools-library.md"),
    },
    BuiltinPageSeed {
        id: "73f0f6ca-3f97-4f17-8fd2-7da19d44516f",
        slug: "troubleshooting",
        title: "Troubleshooting",
        category: "Troubleshooting",
        sort_order: 50,
        content_md: include_str!("content/troubleshooting.md"),
    },
    BuiltinPageSeed {
        id: "198f74aa-3ff0-4a95-b1b8-953c3a898e1f",
        slug: "developer",
        title: "Developer Notes",
        category: "Developer",
        sort_order: 60,
        content_md: include_str!("content/developer.md"),
    },
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HelpPageSummary {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub category: String,
    pub sort_order: i64,
    pub is_builtin: bool,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HelpPageRecord {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub category: String,
    pub sort_order: i64,
    pub content_md: String,
    pub is_builtin: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelpCreatePageInput {
    pub slug: String,
    pub title: String,
    pub category: String,
    pub sort_order: Option<i64>,
    pub content_md: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelpUpdatePageInput {
    pub title: Option<String>,
    pub category: Option<String>,
    pub sort_order: Option<i64>,
    pub content_md: Option<String>,
}

pub async fn open_pool(app: &AppHandle) -> HelpResult<SqlitePool> {
    let pool = crate::tools::db::open_pool(app).await?;
    execute_batch(
        &pool,
        include_str!("../../migrations/0014_create_help_center.sql"),
    )
    .await?;
    seed_builtin_pages_if_needed(&pool).await?;
    ensure_default_app_state(&pool).await?;
    Ok(pool)
}

pub async fn list_pages(pool: &SqlitePool) -> HelpResult<Vec<HelpPageSummary>> {
    let rows = sqlx::query(
        "SELECT id, slug, title, category, sort_order, is_builtin, updated_at
         FROM help_pages
         ORDER BY category COLLATE NOCASE ASC, sort_order ASC, title COLLATE NOCASE ASC",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| HelpPageSummary {
            id: row.get("id"),
            slug: row.get("slug"),
            title: row.get("title"),
            category: row.get("category"),
            sort_order: row.get("sort_order"),
            is_builtin: row.get::<i64, _>("is_builtin") == 1,
            updated_at: row.get("updated_at"),
        })
        .collect())
}

pub async fn get_page(pool: &SqlitePool, slug: &str) -> HelpResult<HelpPageRecord> {
    let normalized_slug = normalize_slug(slug)?;
    let row = sqlx::query(
        "SELECT id, slug, title, category, sort_order, content_md, is_builtin, created_at, updated_at
         FROM help_pages
         WHERE slug = ?1",
    )
    .bind(&normalized_slug)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HelpError::NotFound("Help page not found.".to_string()))?;

    Ok(map_page_row(&row))
}

pub async fn create_page(
    pool: &SqlitePool,
    input: HelpCreatePageInput,
) -> HelpResult<HelpPageRecord> {
    let now = now_epoch_millis()?;
    let slug = normalize_slug(&input.slug)?;
    let title = validate_required("title", &input.title, 160)?;
    let category = validate_required("category", &input.category, 80)?;
    let content_md = validate_required("content_md", &input.content_md, 1_048_576)?;
    let sort_order = input.sort_order.unwrap_or_default();
    let page_id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO help_pages
         (id, slug, title, category, sort_order, content_md, is_builtin, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8)",
    )
    .bind(&page_id)
    .bind(&slug)
    .bind(title)
    .bind(category)
    .bind(sort_order)
    .bind(content_md)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|error| {
        if let sqlx::Error::Database(db_error) = &error {
            if db_error.is_unique_violation() {
                return HelpError::Validation(format!("A page with slug '{slug}' already exists."));
            }
        }
        HelpError::from(error)
    })?;

    get_page(pool, &slug).await
}

pub async fn update_page(
    pool: &SqlitePool,
    slug: &str,
    input: HelpUpdatePageInput,
    developer_mode: bool,
) -> HelpResult<HelpPageRecord> {
    let existing = get_page(pool, slug).await?;
    if existing.is_builtin && !developer_mode {
        return Err(HelpError::Validation(
            "Built-in help pages are read-only unless Developer Mode is enabled.".to_string(),
        ));
    }

    let next_title = match input.title {
        Some(value) => validate_required("title", &value, 160)?,
        None => existing.title.clone(),
    };
    let next_category = match input.category {
        Some(value) => validate_required("category", &value, 80)?,
        None => existing.category.clone(),
    };
    let next_content_md = match input.content_md {
        Some(value) => validate_required("content_md", &value, 1_048_576)?,
        None => existing.content_md.clone(),
    };
    let next_sort_order = input.sort_order.unwrap_or(existing.sort_order);
    let now = now_epoch_millis()?;

    sqlx::query(
        "UPDATE help_pages
         SET title = ?1, category = ?2, sort_order = ?3, content_md = ?4, updated_at = ?5
         WHERE slug = ?6",
    )
    .bind(next_title)
    .bind(next_category)
    .bind(next_sort_order)
    .bind(next_content_md)
    .bind(now)
    .bind(existing.slug.clone())
    .execute(pool)
    .await?;

    get_page(pool, &existing.slug).await
}

pub async fn delete_page(pool: &SqlitePool, slug: &str) -> HelpResult<()> {
    let existing = get_page(pool, slug).await?;
    if existing.is_builtin {
        return Err(HelpError::Validation(
            "Built-in help pages cannot be deleted.".to_string(),
        ));
    }

    sqlx::query("DELETE FROM help_pages WHERE slug = ?1")
        .bind(existing.slug)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn app_state_get(pool: &SqlitePool, key: &str) -> HelpResult<Option<String>> {
    let normalized_key = normalize_state_key(key)?;
    let row = sqlx::query("SELECT value FROM app_state WHERE key = ?1")
        .bind(normalized_key)
        .fetch_optional(pool)
        .await?;

    Ok(row.map(|value| value.get("value")))
}

pub async fn app_state_set(pool: &SqlitePool, key: &str, value: &str) -> HelpResult<()> {
    let normalized_key = normalize_state_key(key)?;
    let normalized_value = normalize_state_value(value)?;
    let now = now_epoch_millis()?;
    sqlx::query(
        "INSERT INTO app_state (key, value, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(normalized_key)
    .bind(normalized_value)
    .bind(now)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn is_developer_mode_enabled(pool: &SqlitePool) -> HelpResult<bool> {
    let raw = app_state_get(pool, BUILTIN_DEVELOPER_MODE_KEY).await?;
    Ok(raw
        .as_deref()
        .map(|value| value.eq_ignore_ascii_case("true"))
        .unwrap_or(false))
}

pub async fn seed_builtin_pages_if_needed(pool: &SqlitePool) -> HelpResult<()> {
    let existing_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM help_pages WHERE is_builtin = 1")
            .fetch_one(pool)
            .await?;
    if existing_count > 0 {
        return Ok(());
    }

    let now = now_epoch_millis()?;
    let mut tx = pool.begin().await?;
    for page in BUILTIN_HELP_PAGES {
        sqlx::query(
            "INSERT OR IGNORE INTO help_pages
             (id, slug, title, category, sort_order, content_md, is_builtin, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?8)",
        )
        .bind(page.id)
        .bind(page.slug)
        .bind(page.title)
        .bind(page.category)
        .bind(page.sort_order)
        .bind(page.content_md)
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    Ok(())
}

pub async fn ensure_default_app_state(pool: &SqlitePool) -> HelpResult<()> {
    let now = now_epoch_millis()?;
    sqlx::query(
        "INSERT OR IGNORE INTO app_state (key, value, updated_at)
         VALUES (?1, ?2, ?3)",
    )
    .bind(BUILTIN_WELCOME_KEY)
    .bind("false")
    .bind(now)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO app_state (key, value, updated_at)
         VALUES (?1, ?2, ?3)",
    )
    .bind(BUILTIN_DEVELOPER_MODE_KEY)
    .bind("false")
    .bind(now)
    .execute(pool)
    .await?;

    Ok(())
}

fn map_page_row(row: &sqlx::sqlite::SqliteRow) -> HelpPageRecord {
    HelpPageRecord {
        id: row.get("id"),
        slug: row.get("slug"),
        title: row.get("title"),
        category: row.get("category"),
        sort_order: row.get("sort_order"),
        content_md: row.get("content_md"),
        is_builtin: row.get::<i64, _>("is_builtin") == 1,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

async fn execute_batch(pool: &SqlitePool, sql_batch: &str) -> HelpResult<()> {
    for statement in sql_batch.split(';') {
        let sql = statement.trim();
        if sql.is_empty() {
            continue;
        }

        sqlx::query(sql).execute(pool).await?;
    }

    Ok(())
}

fn validate_required(field: &str, value: &str, max_len: usize) -> HelpResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(HelpError::Validation(format!("{field} is required.")));
    }
    if trimmed.len() > max_len {
        return Err(HelpError::Validation(format!(
            "{field} exceeds maximum length ({max_len})."
        )));
    }
    Ok(trimmed.to_string())
}

fn normalize_slug(value: &str) -> HelpResult<String> {
    let trimmed = value.trim().to_ascii_lowercase();
    if trimmed.is_empty() {
        return Err(HelpError::Validation("slug is required.".to_string()));
    }
    if trimmed.len() > 120 {
        return Err(HelpError::Validation(
            "slug exceeds maximum length (120).".to_string(),
        ));
    }
    if trimmed.starts_with('-') || trimmed.ends_with('-') {
        return Err(HelpError::Validation(
            "slug cannot start or end with '-'.".to_string(),
        ));
    }
    if !trimmed.chars().all(|character| {
        character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
    }) {
        return Err(HelpError::Validation(
            "slug may only include lowercase letters, digits, and '-'.".to_string(),
        ));
    }
    Ok(trimmed)
}

fn normalize_state_key(value: &str) -> HelpResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(HelpError::Validation(
            "app_state key is required.".to_string(),
        ));
    }
    if trimmed.len() > 120 {
        return Err(HelpError::Validation(
            "app_state key exceeds maximum length (120).".to_string(),
        ));
    }
    if !trimmed
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.'))
    {
        return Err(HelpError::Validation(
            "app_state key contains unsupported characters.".to_string(),
        ));
    }
    Ok(trimmed.to_string())
}

fn normalize_state_value(value: &str) -> HelpResult<String> {
    if value.len() > 8_000 {
        return Err(HelpError::Validation(
            "app_state value exceeds maximum length (8000).".to_string(),
        ));
    }
    Ok(value.to_string())
}

fn now_epoch_millis() -> HelpResult<i64> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| HelpError::Io(format!("System clock error: {error}")))?;
    Ok(duration.as_millis() as i64)
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn create_test_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        execute_batch(
            &pool,
            include_str!("../../migrations/0014_create_help_center.sql"),
        )
        .await
        .unwrap();
        pool
    }

    #[test]
    fn seed_builtin_pages_inserts_once() {
        tauri::async_runtime::block_on(async {
            let pool = create_test_pool().await;

            seed_builtin_pages_if_needed(&pool).await.unwrap();
            seed_builtin_pages_if_needed(&pool).await.unwrap();

            let count: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM help_pages WHERE is_builtin = 1")
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            assert_eq!(count, BUILTIN_HELP_PAGES.len() as i64);
        });
    }

    #[test]
    fn builtin_pages_are_read_only_without_developer_mode() {
        tauri::async_runtime::block_on(async {
            let pool = create_test_pool().await;
            seed_builtin_pages_if_needed(&pool).await.unwrap();

            let result = update_page(
                &pool,
                "introduction",
                HelpUpdatePageInput {
                    title: Some("Edited".to_string()),
                    category: None,
                    sort_order: None,
                    content_md: None,
                },
                false,
            )
            .await;

            assert!(result.is_err());
            assert!(result
                .unwrap_err()
                .user_message()
                .contains("read-only unless Developer Mode is enabled"));
        });
    }
}
