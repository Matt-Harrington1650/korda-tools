use serde::Deserialize;
use tauri::AppHandle;

use super::db::{self, HelpCreatePageInput, HelpPageRecord, HelpPageSummary, HelpUpdatePageInput};
use super::error::HelpResult;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelpCreatePageRequest {
    pub slug: String,
    pub title: String,
    pub category: String,
    pub sort_order: Option<i64>,
    pub content_md: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelpUpdatePageRequest {
    pub title: Option<String>,
    pub category: Option<String>,
    pub sort_order: Option<i64>,
    pub content_md: Option<String>,
}

#[tauri::command]
pub async fn help_list_pages(app: AppHandle) -> Result<Vec<HelpPageSummary>, String> {
    run(async {
        let pool = db::open_pool(&app).await?;
        db::list_pages(&pool).await
    })
    .await
}

#[tauri::command]
pub async fn help_get_page(app: AppHandle, slug: String) -> Result<HelpPageRecord, String> {
    run(async {
        let pool = db::open_pool(&app).await?;
        db::get_page(&pool, slug.trim()).await
    })
    .await
}

#[tauri::command]
pub async fn help_create_page(
    app: AppHandle,
    request: HelpCreatePageRequest,
) -> Result<HelpPageRecord, String> {
    run(async {
        let pool = db::open_pool(&app).await?;
        db::create_page(
            &pool,
            HelpCreatePageInput {
                slug: request.slug,
                title: request.title,
                category: request.category,
                sort_order: request.sort_order,
                content_md: request.content_md,
            },
        )
        .await
    })
    .await
}

#[tauri::command]
pub async fn help_update_page(
    app: AppHandle,
    slug: String,
    request: HelpUpdatePageRequest,
) -> Result<HelpPageRecord, String> {
    run(async {
        let pool = db::open_pool(&app).await?;
        let developer_mode = db::is_developer_mode_enabled(&pool).await?;
        db::update_page(
            &pool,
            slug.trim(),
            HelpUpdatePageInput {
                title: request.title,
                category: request.category,
                sort_order: request.sort_order,
                content_md: request.content_md,
            },
            developer_mode,
        )
        .await
    })
    .await
}

#[tauri::command]
pub async fn help_delete_page(app: AppHandle, slug: String) -> Result<(), String> {
    run(async {
        let pool = db::open_pool(&app).await?;
        db::delete_page(&pool, slug.trim()).await
    })
    .await
}

#[tauri::command]
pub async fn app_state_get(app: AppHandle, key: String) -> Result<Option<String>, String> {
    run(async {
        let pool = db::open_pool(&app).await?;
        db::app_state_get(&pool, key.trim()).await
    })
    .await
}

#[tauri::command]
pub async fn app_state_set(app: AppHandle, key: String, value: String) -> Result<(), String> {
    run(async {
        let pool = db::open_pool(&app).await?;
        db::app_state_set(&pool, key.trim(), &value).await
    })
    .await
}

async fn run<T, F>(future: F) -> Result<T, String>
where
    F: std::future::Future<Output = HelpResult<T>>,
{
    future.await.map_err(|error| error.user_message())
}
