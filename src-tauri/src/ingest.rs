use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::menu::MenuBuilder;
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, Window, WindowEvent};
use uuid::Uuid;

const ACTIVE_TICK_SECS: u64 = 5;
const IDLE_TICK_SECS: u64 = 15;
const ACTIVE_HEALTH_POLL_MS: i64 = 15_000;
const IDLE_HEALTH_POLL_MS: i64 = 60_000;
const ALERT_STATUS_OPEN: &str = "open";
const ALERT_STATUS_ACKED: &str = "acked";
const JOB_EVENT_NAME: &str = "sophon://ingest/job";
const FILE_EVENT_NAME: &str = "sophon://ingest/file";
const ALERT_EVENT_NAME: &str = "sophon://ingest/alert";
const HEALTH_EVENT_NAME: &str = "sophon://ingest/health";
const QUIT_WARNING_EVENT_NAME: &str = "sophon://ingest/quit-warning";
const WINDOW_HIDDEN_EVENT_NAME: &str = "sophon://ingest/window-hidden";
const TRAY_SHOW_ID: &str = "tray_show_main";
const TRAY_QUIT_ID: &str = "tray_quit_app";

static SUPERVISOR_STATE: OnceLock<Arc<IngestSupervisorState>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestSourceSettings {
    #[serde(default)]
    pub include_patterns: Vec<String>,
    #[serde(default)]
    pub exclude_patterns: Vec<String>,
    #[serde(default)]
    pub allowed_extensions: Vec<String>,
    pub max_file_size_mb: i64,
    pub max_pages: i64,
    pub watch_enabled: bool,
    pub watch_interval_sec: i64,
    pub debounce_seconds: i64,
    pub chunk_size: i64,
    pub chunk_overlap: i64,
    pub page_aware_chunking: bool,
    pub ocr_enabled: bool,
    pub extraction_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestSourceSnapshot {
    pub source_id: String,
    pub source_name: String,
    pub source_type: String,
    pub path: String,
    pub settings: IngestSourceSettings,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestJobOptions {
    #[serde(default)]
    pub dry_run: bool,
    #[serde(default)]
    pub safe_mode: bool,
    #[serde(default = "default_max_workers")]
    pub max_workers: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestQueueSourceRequest {
    pub source: IngestSourceSnapshot,
    #[serde(default)]
    pub options: IngestJobOptions,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestQueueSourceResponse {
    pub job_id: String,
    pub discovered_files: usize,
    pub collection_name: String,
    pub status: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestJobActionRequest {
    pub job_id: String,
    pub action: String,
    #[serde(default)]
    pub file_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestJobSummary {
    pub job_id: String,
    pub source_id: String,
    pub source_name: String,
    pub collection_name: String,
    pub status: String,
    pub current_stage: String,
    pub progress_pct: f64,
    pub created_at: i64,
    pub started_at: Option<i64>,
    pub updated_at: i64,
    pub ended_at: Option<i64>,
    pub stage_started_at: Option<i64>,
    pub last_heartbeat_at: Option<i64>,
    pub worker_id: Option<String>,
    pub retry_count: i64,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub detail_message: Option<String>,
    pub current_file_id: Option<String>,
    pub current_file_name: Option<String>,
    pub total_files: i64,
    pub completed_files: i64,
    pub failed_files: i64,
    pub active_alerts: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestFileRecord {
    pub file_id: String,
    pub job_id: String,
    pub parent_file_id: Option<String>,
    pub source_path: String,
    pub staged_path: Option<String>,
    pub display_name: String,
    pub size_bytes: i64,
    pub mime_type: Option<String>,
    pub page_count: Option<i64>,
    pub page_range_start: Option<i64>,
    pub page_range_end: Option<i64>,
    pub status: String,
    pub current_stage: String,
    pub progress_pct: f64,
    pub last_heartbeat_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
    pub checkpoint_json: Option<Value>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestStageRunRecord {
    pub run_id: String,
    pub job_id: String,
    pub file_id: Option<String>,
    pub stage: String,
    pub status: String,
    pub progress_pct: f64,
    pub detail_message: Option<String>,
    pub started_at: i64,
    pub updated_at: i64,
    pub ended_at: Option<i64>,
    pub heartbeat_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestEventRecord {
    pub event_id: String,
    pub job_id: String,
    pub file_id: Option<String>,
    pub level: String,
    pub kind: String,
    pub stage: Option<String>,
    pub message: String,
    pub payload_json: Option<Value>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestAlertRecord {
    pub alert_id: String,
    pub job_id: Option<String>,
    pub file_id: Option<String>,
    pub severity: String,
    pub kind: String,
    pub status: String,
    pub title: String,
    pub message: String,
    pub payload_json: Option<Value>,
    pub created_at: i64,
    pub updated_at: i64,
    pub acknowledged_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestHealthProbe {
    pub id: String,
    pub label: String,
    pub url: String,
    pub status: String,
    pub healthy: bool,
    pub latency_ms: Option<u128>,
    pub message: String,
    pub details: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestHealthSnapshot {
    pub checked_at: i64,
    pub overall_status: String,
    pub active_job_count: i64,
    pub probes: Vec<IngestHealthProbe>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestJobDetail {
    pub job: IngestJobSummary,
    pub source_snapshot: Value,
    pub options: Value,
    pub checkpoint_json: Option<Value>,
    pub files: Vec<IngestFileRecord>,
    pub stage_runs: Vec<IngestStageRunRecord>,
    pub events: Vec<IngestEventRecord>,
    pub alerts: Vec<IngestAlertRecord>,
}

#[derive(Debug, Clone)]
struct EnumeratedFile {
    source_path: String,
    display_name: String,
    size_bytes: i64,
    mime_type: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct EnumerateDiagnostics {
    source_path: String,
    configured_source_type: String,
    resolved_source_mode: String,
    candidate_file_count: usize,
    matched_file_count: usize,
    rejected_by_exclude: usize,
    rejected_by_extension: usize,
    rejected_by_size: usize,
    effective_include_patterns: Vec<String>,
    effective_exclude_patterns: Vec<String>,
    allowed_extensions: Vec<String>,
    sample_rejections: Vec<String>,
}

struct IngestSupervisorState {
    app: AppHandle,
    pool: SqlitePool,
    health: Mutex<IngestHealthSnapshot>,
    worker_process: Mutex<Option<Child>>,
    tray_icon: Mutex<Option<tauri::tray::TrayIcon<tauri::Wry>>>,
    started: AtomicBool,
}

impl IngestSupervisorState {
    fn new(app: AppHandle, pool: SqlitePool) -> Self {
        Self {
            app,
            pool,
            health: Mutex::new(IngestHealthSnapshot {
                checked_at: 0,
                overall_status: "unknown".to_string(),
                active_job_count: 0,
                probes: Vec::new(),
            }),
            worker_process: Mutex::new(None),
            tray_icon: Mutex::new(None),
            started: AtomicBool::new(false),
        }
    }
}

pub fn setup(app: AppHandle) -> Result<(), String> {
    let pool = tauri::async_runtime::block_on(open_pool(&app))?;
    let state =
        SUPERVISOR_STATE.get_or_init(|| Arc::new(IngestSupervisorState::new(app.clone(), pool)));
    if state.started.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    setup_tray(state)?;

    let state = state.clone();
    tauri::async_runtime::spawn(async move {
        supervisor_loop(state).await;
    });
    Ok(())
}

#[tauri::command]
pub async fn ingest_queue_source(
    app: AppHandle,
    request: IngestQueueSourceRequest,
) -> Result<IngestQueueSourceResponse, String> {
    let pool = open_pool(&app).await?;
    let now = now_epoch_millis()?;
    let job_id = format!("ingest-job-{}", Uuid::new_v4());
    let options = normalize_options(request.options);
    let collection_name = sanitize_collection_name(&request.source.source_name);
    let (files, diagnostics) = enumerate_source(&request.source)?;

    let mut tx = pool.begin().await.map_err(|error| error.to_string())?;
    let source_snapshot =
        serde_json::to_value(&request.source).map_err(|error| error.to_string())?;
    let options_json = serde_json::to_value(&options).map_err(|error| error.to_string())?;
    let initial_status = if files.is_empty() {
        "failed"
    } else if options.dry_run {
        "completed"
    } else {
        "queued"
    };
    let initial_stage = if files.is_empty() {
        "preflight"
    } else {
        "queued"
    };
    let initial_progress = if options.dry_run { 100.0 } else { 0.0 };
    let error_message = if files.is_empty() {
        Some(
            format!(
                "No files matched source settings. SourcePath={}; ConfiguredSourceType={}; ResolvedSourceMode={}; Candidates={}; RejectedByExclude={}; RejectedByExtension={}; RejectedBySize={}; Include={:?}; AllowedExtensions={:?}; SampleRejections={:?}",
                diagnostics.source_path,
                diagnostics.configured_source_type,
                diagnostics.resolved_source_mode,
                diagnostics.candidate_file_count,
                diagnostics.rejected_by_exclude,
                diagnostics.rejected_by_extension,
                diagnostics.rejected_by_size,
                diagnostics.effective_include_patterns,
                diagnostics.allowed_extensions,
                diagnostics.sample_rejections,
            )
        )
    } else {
        None
    };
    let error_code = if files.is_empty() {
        Some("enumerate_no_matches".to_string())
    } else {
        None
    };
    let ended_at = if files.is_empty() || options.dry_run {
        Some(now)
    } else {
        None
    };
    let checkpoint_json = Some(json!({
        "enumerateDiagnostics": diagnostics,
        "requestSnapshot": source_snapshot,
    }));

    sqlx::query(
        "INSERT INTO ingest_jobs (
            job_id, source_id, source_name, collection_name, status, current_stage, progress_pct,
            created_at, started_at, updated_at, ended_at, last_heartbeat_at, stage_started_at,
            worker_id, lease_expires_at, retry_count, error_code, error_message,
            checkpoint_json, detail_message, current_file_id, source_snapshot_json, options_json
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7,
            ?8, ?9, ?10, ?11, ?12, ?13,
            NULL, NULL, 0, ?14, ?15,
            ?16, ?17, NULL, ?18, ?19
        )",
    )
    .bind(&job_id)
    .bind(&request.source.source_id)
    .bind(&request.source.source_name)
    .bind(&collection_name)
    .bind(initial_status)
    .bind(initial_stage)
    .bind(initial_progress)
    .bind(now)
    .bind(if files.is_empty() || options.dry_run {
        Some(now)
    } else {
        None
    })
    .bind(now)
    .bind(ended_at)
    .bind(if files.is_empty() || options.dry_run {
        Some(now)
    } else {
        None
    })
    .bind(Some(now))
    .bind(error_code)
    .bind(error_message.clone())
    .bind(checkpoint_json.map(|value| value.to_string()))
    .bind(if files.is_empty() {
        Some("Preflight failed during enumerate.".to_string())
    } else if options.dry_run {
        Some("Dry-run completed after preflight.".to_string())
    } else {
        Some("Queued for background ingestion.".to_string())
    })
    .bind(source_snapshot.to_string())
    .bind(options_json.to_string())
    .execute(&mut *tx)
    .await
    .map_err(|error| error.to_string())?;

    for file in &files {
        let file_id = format!("ingest-file-{}", Uuid::new_v4());
        sqlx::query(
            "INSERT INTO ingest_files (
                file_id, job_id, parent_file_id, source_path, staged_path, display_name, size_bytes,
                mime_type, page_count, page_range_start, page_range_end, status, current_stage,
                progress_pct, last_heartbeat_at, checkpoint_json, error_code, error_message,
                created_at, updated_at
            ) VALUES (
                ?1, ?2, NULL, ?3, NULL, ?4, ?5,
                ?6, NULL, NULL, NULL, ?7, ?8,
                0, NULL, NULL, NULL, NULL,
                ?9, ?10
            )",
        )
        .bind(file_id)
        .bind(&job_id)
        .bind(&file.source_path)
        .bind(&file.display_name)
        .bind(file.size_bytes)
        .bind(&file.mime_type)
        .bind(if options.dry_run {
            "completed"
        } else {
            "queued"
        })
        .bind(if options.dry_run {
            "preflight"
        } else {
            "queued"
        })
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    }

    insert_event_tx(
        &mut tx,
        &job_id,
        None,
        "info",
        "job_queued",
        Some("queued"),
        &format!(
            "Queued {} file(s) from source '{}'.",
            files.len(),
            request.source.source_name
        ),
        Some(json!({
            "collectionName": collection_name,
            "diagnostics": diagnostics,
            "dryRun": options.dry_run,
            "safeMode": options.safe_mode,
        })),
        now,
    )
    .await?;

    if files.is_empty() {
        insert_alert_tx(
            &mut tx,
            Some(&job_id),
            None,
            "error",
            "job_failed",
            ALERT_STATUS_OPEN,
            "No files matched source settings",
            error_message
                .as_deref()
                .unwrap_or("Enumerate produced zero files."),
            Some(json!({ "diagnostics": diagnostics })),
            now,
        )
        .await?;
    }

    tx.commit().await.map_err(|error| error.to_string())?;
    emit_snapshots_for_app(&app).await?;

    Ok(IngestQueueSourceResponse {
        job_id,
        discovered_files: files.len(),
        collection_name,
        status: initial_status.to_string(),
    })
}

#[tauri::command]
pub async fn ingest_list_jobs(app: AppHandle) -> Result<Vec<IngestJobSummary>, String> {
    let pool = open_pool(&app).await?;
    list_jobs(&pool).await
}

#[tauri::command]
pub async fn ingest_get_job(app: AppHandle, job_id: String) -> Result<IngestJobDetail, String> {
    let pool = open_pool(&app).await?;
    get_job_detail(&pool, &job_id).await
}

#[tauri::command]
pub async fn ingest_job_action(
    app: AppHandle,
    request: IngestJobActionRequest,
) -> Result<IngestJobDetail, String> {
    let pool = open_pool(&app).await?;
    let now = now_epoch_millis()?;
    let action = request.action.trim().to_ascii_lowercase();
    let current = get_job_detail(&pool, &request.job_id).await?;

    let mut tx = pool.begin().await.map_err(|error| error.to_string())?;
    match action.as_str() {
        "pause" => {
            sqlx::query(
                "UPDATE ingest_jobs
                 SET status = 'paused', updated_at = ?2, detail_message = ?3
                 WHERE job_id = ?1 AND status IN ('queued', 'running', 'blocked')",
            )
            .bind(&request.job_id)
            .bind(now)
            .bind("Paused by operator.")
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
        }
        "resume" | "resume_job" => {
            sqlx::query(
                "UPDATE ingest_jobs
                 SET status = 'queued', updated_at = ?2, error_code = NULL, error_message = NULL, detail_message = ?3
                 WHERE job_id = ?1 AND status IN ('paused', 'blocked', 'stuck', 'failed', 'cancelled')",
            )
            .bind(&request.job_id)
            .bind(now)
            .bind("Re-queued by operator.")
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
        }
        "cancel" => {
            sqlx::query(
                "UPDATE ingest_jobs
                 SET status = 'cancelled', ended_at = ?2, updated_at = ?2, error_code = 'cancelled', error_message = 'Cancelled by operator.', detail_message = 'Cancelled by operator.'
                 WHERE job_id = ?1 AND status NOT IN ('completed', 'failed', 'cancelled')",
            )
            .bind(&request.job_id)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
        }
        "retry_stage" => {
            sqlx::query(
                "UPDATE ingest_jobs
                 SET status = 'queued', updated_at = ?2, ended_at = NULL, error_code = NULL, error_message = NULL, detail_message = 'Stage retry requested.', retry_count = retry_count + 1
                 WHERE job_id = ?1",
            )
            .bind(&request.job_id)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
            let file_id = request
                .file_id
                .clone()
                .or(current.job.current_file_id.clone());
            if let Some(file_id) = file_id {
                reset_file_tx(&mut tx, &file_id, now, "Stage retry requested.").await?;
            }
        }
        "retry_file" => {
            let file_id = request
                .file_id
                .clone()
                .or(current.job.current_file_id.clone())
                .ok_or_else(|| "retry_file requires fileId or a current file.".to_string())?;
            reset_file_tx(&mut tx, &file_id, now, "File retry requested.").await?;
            sqlx::query(
                "UPDATE ingest_jobs
                 SET status = 'queued', updated_at = ?2, ended_at = NULL, error_code = NULL, error_message = NULL, detail_message = 'File retry requested.', retry_count = retry_count + 1, progress_pct = 0
                 WHERE job_id = ?1",
            )
            .bind(&request.job_id)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
        }
        "skip_file" => {
            let file_id = request
                .file_id
                .clone()
                .or(current.job.current_file_id.clone())
                .ok_or_else(|| "skip_file requires fileId or a current file.".to_string())?;
            sqlx::query(
                "UPDATE ingest_files
                 SET status = 'skipped', current_stage = 'verification', progress_pct = 100, updated_at = ?2, error_code = 'skipped', error_message = 'Skipped by operator.'
                 WHERE file_id = ?1",
            )
            .bind(file_id)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
            sqlx::query(
                "UPDATE ingest_jobs
                 SET status = 'queued', updated_at = ?2, detail_message = 'File skipped by operator.', error_code = NULL, error_message = NULL
                 WHERE job_id = ?1 AND status <> 'completed'",
            )
            .bind(&request.job_id)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
        }
        "quarantine_file" => {
            let file_id = request
                .file_id
                .clone()
                .or(current.job.current_file_id.clone())
                .ok_or_else(|| "quarantine_file requires fileId or a current file.".to_string())?;
            sqlx::query(
                "UPDATE ingest_files
                 SET status = 'quarantined', updated_at = ?2, error_code = 'quarantined', error_message = 'Quarantined by operator.'
                 WHERE file_id = ?1",
            )
            .bind(file_id)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
            sqlx::query(
                "UPDATE ingest_jobs
                 SET status = 'queued', updated_at = ?2, detail_message = 'File quarantined by operator.'
                 WHERE job_id = ?1",
            )
            .bind(&request.job_id)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
        }
        _ => return Err(format!("Unsupported ingest action '{}'.", request.action)),
    }

    insert_event_tx(
        &mut tx,
        &request.job_id,
        request.file_id.as_deref(),
        "info",
        "operator_action",
        None,
        &format!("Operator requested action '{}'.", action),
        Some(json!({ "action": action })),
        now,
    )
    .await?;
    tx.commit().await.map_err(|error| error.to_string())?;

    emit_snapshots_for_app(&app).await?;
    get_job_detail(&pool, &request.job_id).await
}

#[tauri::command]
pub async fn ingest_list_alerts(
    app: AppHandle,
    limit: Option<u32>,
) -> Result<Vec<IngestAlertRecord>, String> {
    let pool = open_pool(&app).await?;
    list_alerts(&pool, limit.unwrap_or(50) as i64).await
}

#[tauri::command]
pub async fn ingest_ack_alert(app: AppHandle, alert_id: String) -> Result<(), String> {
    let pool = open_pool(&app).await?;
    let now = now_epoch_millis()?;
    sqlx::query(
        "UPDATE ingest_alerts
         SET status = ?2, updated_at = ?3, acknowledged_at = ?3
         WHERE alert_id = ?1",
    )
    .bind(alert_id)
    .bind(ALERT_STATUS_ACKED)
    .bind(now)
    .execute(&pool)
    .await
    .map_err(|error| error.to_string())?;
    emit_snapshots_for_app(&app).await
}

#[tauri::command]
pub async fn ingest_get_health_snapshot(app: AppHandle) -> Result<IngestHealthSnapshot, String> {
    if let Some(state) = SUPERVISOR_STATE.get() {
        return Ok(state
            .health
            .lock()
            .map_err(|_| "health state poisoned".to_string())?
            .clone());
    }
    let pool = open_pool(&app).await?;
    Ok(poll_dependency_health(active_job_count(&pool).await?).await)
}

#[tauri::command]
pub fn ingest_force_exit(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

pub fn handle_window_event(window: &Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        let active_jobs = active_job_count_sync(&window.app_handle());
        if active_jobs > 0 {
            api.prevent_close();
            let _ = window.hide();
            let _ = window.app_handle().emit(
                WINDOW_HIDDEN_EVENT_NAME,
                json!({
                    "activeJobCount": active_jobs,
                }),
            );
        }
    }
}

async fn supervisor_loop(state: Arc<IngestSupervisorState>) {
    let mut last_health_poll = 0_i64;
    loop {
        let active_jobs = match active_job_count(&state.pool).await {
            Ok(value) => value,
            Err(error) => {
                log::error!("ingest supervisor failed to count active jobs: {error}");
                0
            }
        };

        if let Err(error) = ensure_worker_running(&state).await {
            log::error!("ingest worker ensure failed: {error}");
        }

        let now = now_epoch_millis().unwrap_or_default();
        let health_poll_interval = if active_jobs > 0 {
            ACTIVE_HEALTH_POLL_MS
        } else {
            IDLE_HEALTH_POLL_MS
        };
        if now - last_health_poll >= health_poll_interval {
            let health = poll_dependency_health(active_jobs).await;
            if let Ok(mut guard) = state.health.lock() {
                *guard = health.clone();
            }
            if let Err(error) = reconcile_dependency_health(&state.pool, &health).await {
                log::error!("ingest health reconciliation failed: {error}");
            }
            last_health_poll = now;
        }

        if let Err(error) = run_watchdog(&state.pool).await {
            log::error!("ingest watchdog failed: {error}");
        }
        if let Err(error) = emit_snapshots(&state).await {
            log::error!("ingest emit failed: {error}");
        }

        let sleep_secs = if active_jobs > 0 {
            ACTIVE_TICK_SECS
        } else {
            IDLE_TICK_SECS
        };
        std::thread::sleep(Duration::from_secs(sleep_secs));
    }
}

fn setup_tray(state: &Arc<IngestSupervisorState>) -> Result<(), String> {
    let mut guard = state
        .tray_icon
        .lock()
        .map_err(|_| "tray icon mutex poisoned".to_string())?;
    if guard.is_some() {
        return Ok(());
    }

    let menu = MenuBuilder::new(&state.app)
        .text(TRAY_SHOW_ID, "Show Korda Tools")
        .separator()
        .text(TRAY_QUIT_ID, "Quit Korda Tools")
        .build()
        .map_err(|error| error.to_string())?;

    let mut builder = TrayIconBuilder::with_id("korda-tools-ingest")
        .menu(&menu)
        .tooltip("Korda Tools")
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            if event.id() == TRAY_SHOW_ID {
                let _ = show_main_window(app);
            } else if event.id() == TRAY_QUIT_ID {
                handle_quit_request(app);
            }
        });

    if let Some(icon) = state.app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    let tray_icon = builder
        .build(&state.app)
        .map_err(|error| error.to_string())?;
    *guard = Some(tray_icon);
    Ok(())
}

fn show_main_window(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    window.show().map_err(|error| error.to_string())?;
    let _ = window.unminimize();
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

fn handle_quit_request(app: &AppHandle) {
    let active_jobs = active_job_count_sync(app);
    if active_jobs > 0 {
        let _ = show_main_window(app);
        let _ = app.emit(
            QUIT_WARNING_EVENT_NAME,
            json!({
                "activeJobCount": active_jobs,
            }),
        );
        return;
    }
    app.exit(0);
}

fn active_job_count_sync(app: &AppHandle) -> i64 {
    if let Some(state) = SUPERVISOR_STATE.get() {
        return tauri::async_runtime::block_on(active_job_count(&state.pool)).unwrap_or(0);
    }
    match tauri::async_runtime::block_on(open_pool(app)) {
        Ok(pool) => tauri::async_runtime::block_on(active_job_count(&pool)).unwrap_or(0),
        Err(_) => 0,
    }
}

async fn emit_snapshots_for_app(app: &AppHandle) -> Result<(), String> {
    let pool = open_pool(app).await?;
    let health = if let Some(state) = SUPERVISOR_STATE.get() {
        state
            .health
            .lock()
            .map_err(|_| "health state poisoned".to_string())?
            .clone()
    } else {
        poll_dependency_health(active_job_count(&pool).await?).await
    };

    let jobs = list_jobs(&pool).await?;
    let alerts = list_alerts(&pool, 50).await?;
    let files = list_active_files(&pool).await?;

    app.emit(JOB_EVENT_NAME, &jobs)
        .map_err(|error| error.to_string())?;
    app.emit(FILE_EVENT_NAME, &files)
        .map_err(|error| error.to_string())?;
    app.emit(ALERT_EVENT_NAME, &alerts)
        .map_err(|error| error.to_string())?;
    app.emit(HEALTH_EVENT_NAME, &health)
        .map_err(|error| error.to_string())?;
    Ok(())
}

async fn emit_snapshots(state: &Arc<IngestSupervisorState>) -> Result<(), String> {
    let jobs = list_jobs(&state.pool).await?;
    let alerts = list_alerts(&state.pool, 50).await?;
    let files = list_active_files(&state.pool).await?;
    let health = state
        .health
        .lock()
        .map_err(|_| "health state poisoned".to_string())?
        .clone();

    state
        .app
        .emit(JOB_EVENT_NAME, &jobs)
        .map_err(|error| error.to_string())?;
    state
        .app
        .emit(FILE_EVENT_NAME, &files)
        .map_err(|error| error.to_string())?;
    state
        .app
        .emit(ALERT_EVENT_NAME, &alerts)
        .map_err(|error| error.to_string())?;
    state
        .app
        .emit(HEALTH_EVENT_NAME, &health)
        .map_err(|error| error.to_string())?;
    Ok(())
}

async fn ensure_worker_running(state: &Arc<IngestSupervisorState>) -> Result<(), String> {
    let mut guard = state
        .worker_process
        .lock()
        .map_err(|_| "worker process mutex poisoned".to_string())?;
    let worker_is_alive = match guard.as_mut() {
        Some(process) => matches!(process.try_wait(), Ok(None)),
        None => false,
    };
    if worker_is_alive {
        return Ok(());
    }

    *guard = None;
    let child = spawn_worker(&state.app)?;
    *guard = Some(child);
    Ok(())
}

fn resolve_worker_script_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("scripts")
        .join("sophon_ingest_worker.py");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("failed to resolve resource_dir: {error}"))?;
    let candidates = [
        resource_dir.join("sophon_ingest_worker.py"),
        resource_dir.join("scripts").join("sophon_ingest_worker.py"),
    ];
    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }
    Err("unable to locate sophon_ingest_worker.py".to_string())
}

fn resolve_worker_temp_dir(app_data_dir: &Path) -> Result<String, String> {
    if let Ok(explicit) = std::env::var("TEMP_DIR") {
        let trimmed = explicit.trim();
        if !trimmed.is_empty() {
            let explicit_path = PathBuf::from(trimmed);
            fs::create_dir_all(&explicit_path).map_err(|error| {
                format!(
                    "failed to create TEMP_DIR for ingest worker ({}): {error}",
                    explicit_path.to_string_lossy()
                )
            })?;
            return Ok(explicit_path.to_string_lossy().to_string());
        }
    }

    let fallback = app_data_dir.join("sophon-tmp");
    fs::create_dir_all(&fallback).map_err(|error| {
        format!(
            "failed to create fallback temp dir for ingest worker ({}): {error}",
            fallback.to_string_lossy()
        )
    })?;
    Ok(fallback.to_string_lossy().to_string())
}

fn build_worker_candidate(
    program: String,
    prefix_args: &[&str],
    script_path: &str,
    db_path: &Path,
    worker_id: &str,
    app_data_dir: &Path,
    ingestor_base_url: &str,
    rag_base_url: &str,
) -> (String, Vec<String>) {
    let mut args = prefix_args
        .iter()
        .map(|value| (*value).to_string())
        .collect::<Vec<_>>();
    args.push("-u".to_string());
    args.push(script_path.to_string());
    args.extend_from_slice(&[
        "--db-path".to_string(),
        db_path.to_string_lossy().to_string(),
        "--worker-id".to_string(),
        worker_id.to_string(),
        "--app-data-dir".to_string(),
        app_data_dir.to_string_lossy().to_string(),
        "--ingestor-base-url".to_string(),
        ingestor_base_url.to_string(),
        "--rag-base-url".to_string(),
        rag_base_url.to_string(),
    ]);
    (program, args)
}

fn spawn_worker(app: &AppHandle) -> Result<Child, String> {
    let script_path = resolve_worker_script_path(app)?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app_data_dir: {error}"))?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("failed to create app_data_dir for ingest worker: {error}"))?;
    let temp_dir = resolve_worker_temp_dir(&app_data_dir)?;
    let db_path = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("failed to resolve app_config_dir: {error}"))?
        .join(crate::tools::db::DB_FILE_NAME);
    let worker_id = format!("worker-{}", Uuid::new_v4());
    let script_arg = script_path.to_string_lossy().to_string();
    let ingestor_base_url = std::env::var("SOPHON_INGESTOR_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:8082/v1".to_string());
    let rag_base_url = std::env::var("SOPHON_RAG_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:8081/v1".to_string());

    let mut candidates = Vec::new();
    if let Ok(custom_python) = std::env::var("SOPHON_PYTHON_BIN") {
        if !custom_python.trim().is_empty() {
            candidates.push(build_worker_candidate(
                custom_python,
                &[],
                &script_arg,
                &db_path,
                &worker_id,
                &app_data_dir,
                &ingestor_base_url,
                &rag_base_url,
            ));
        }
    }
    if cfg!(windows) {
        candidates.push(build_worker_candidate(
            "py".to_string(),
            &["-3.12"],
            &script_arg,
            &db_path,
            &worker_id,
            &app_data_dir,
            &ingestor_base_url,
            &rag_base_url,
        ));
    }
    candidates.push(build_worker_candidate(
        "python".to_string(),
        &[],
        &script_arg,
        &db_path,
        &worker_id,
        &app_data_dir,
        &ingestor_base_url,
        &rag_base_url,
    ));

    let mut startup_errors = Vec::new();
    for (program, args) in candidates {
        let mut command = Command::new(&program);
        command.args(&args);
        command.stdin(Stdio::null());
        command.stdout(Stdio::inherit());
        command.stderr(Stdio::inherit());
        command.env("SOPHON_APP_DATA_DIR", app_data_dir.as_os_str());
        command.env("TEMP_DIR", &temp_dir);
        command.env("TMPDIR", &temp_dir);
        command.env("TMP", &temp_dir);
        command.env("TEMP", &temp_dir);

        match command.spawn() {
            Ok(child) => {
                log::info!("spawned ingest worker using {}", program);
                return Ok(child);
            }
            Err(error) => {
                startup_errors.push(format!("{} {} => {}", program, args.join(" "), error));
            }
        }
    }

    Err(format!(
        "failed to start ingest worker. attempts: {}",
        startup_errors.join(" | ")
    ))
}

async fn reconcile_dependency_health(
    pool: &SqlitePool,
    health: &IngestHealthSnapshot,
) -> Result<(), String> {
    let now = now_epoch_millis()?;
    let blocking_probes = blocking_ingest_probes(health);
    let dependencies_healthy = if blocking_probes.is_empty() {
        health.probes.iter().all(|probe| probe.healthy)
    } else {
        blocking_probes.iter().all(|probe| probe.healthy)
    };
    if dependencies_healthy {
        let blocked_jobs = sqlx::query_scalar::<_, String>(
            "SELECT job_id
             FROM ingest_jobs
             WHERE status = 'blocked' AND error_code = 'dependency_unhealthy'",
        )
        .fetch_all(pool)
        .await
        .map_err(|error| error.to_string())?;
        for job_id in blocked_jobs {
            sqlx::query(
                "UPDATE ingest_files
                 SET status = 'queued', updated_at = ?2, error_code = NULL, error_message = NULL
                 WHERE job_id = ?1 AND status = 'blocked'",
            )
            .bind(&job_id)
            .bind(now)
            .execute(pool)
            .await
            .map_err(|error| error.to_string())?;
        }
        sqlx::query(
            "UPDATE ingest_jobs
             SET status = 'queued', updated_at = ?1, error_code = NULL, error_message = NULL, detail_message = 'Dependencies recovered; job re-queued.'
             WHERE status = 'blocked' AND error_code = 'dependency_unhealthy'",
        )
        .bind(now)
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;
        return Ok(());
    }

    let message = if blocking_probes.is_empty() {
        health
            .probes
            .iter()
            .filter(|probe| !probe.healthy)
            .collect::<Vec<_>>()
    } else {
        blocking_probes
            .into_iter()
            .filter(|probe| !probe.healthy)
            .collect::<Vec<_>>()
    }
    .into_iter()
        .map(|probe| format!("{}: {}", probe.label, probe.message))
        .collect::<Vec<_>>()
        .join(" | ");

    let blocked_jobs = sqlx::query(
        "SELECT job_id
         FROM ingest_jobs
         WHERE status IN ('queued', 'running')",
    )
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;
    for row in blocked_jobs {
        let job_id: String = row.get("job_id");
        sqlx::query(
            "UPDATE ingest_jobs
             SET status = 'blocked', updated_at = ?2, error_code = 'dependency_unhealthy', error_message = ?3, detail_message = 'Blocked by dependency health.'
             WHERE job_id = ?1 AND status IN ('queued', 'running')",
        )
        .bind(&job_id)
        .bind(now)
        .bind(&message)
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;
        upsert_alert(
            pool,
            Some(&job_id),
            None,
            "error",
            "dependency_unhealthy",
            "Dependency unhealthy",
            &message,
            Some(json!({ "probes": health.probes })),
        )
        .await?;
    }
    Ok(())
}

async fn run_watchdog(pool: &SqlitePool) -> Result<(), String> {
    let now = now_epoch_millis()?;
    let rows = sqlx::query(
        "SELECT j.job_id, j.current_stage, j.progress_pct, j.updated_at, j.last_heartbeat_at,
                f.size_bytes, f.page_count
         FROM ingest_jobs j
         LEFT JOIN ingest_files f ON f.file_id = j.current_file_id
         WHERE j.status = 'running'",
    )
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;

    for row in rows {
        let job_id: String = row.get("job_id");
        let current_stage: String = row.get("current_stage");
        let progress_pct: f64 = row.get("progress_pct");
        let updated_at: i64 = row.get("updated_at");
        let last_heartbeat_at: Option<i64> = row.try_get("last_heartbeat_at").ok();
        let size_bytes: Option<i64> = row.try_get("size_bytes").ok();
        let page_count: Option<i64> = row.try_get("page_count").ok();
        let heartbeat_ref = last_heartbeat_at.unwrap_or(updated_at);
        let threshold = stage_threshold_ms(&current_stage, size_bytes, page_count);
        let stale_for = now - heartbeat_ref;
        let stale_progress_for = now - updated_at;

        if stale_for <= threshold || stale_progress_for <= threshold {
            continue;
        }

        if stale_for > threshold * 2 {
            sqlx::query(
                "UPDATE ingest_jobs
                 SET status = 'stuck', updated_at = ?2, error_code = 'watchdog_stuck', error_message = ?3, detail_message = 'Marked stuck by watchdog.'
                 WHERE job_id = ?1 AND status = 'running'",
            )
            .bind(&job_id)
            .bind(now)
            .bind(format!(
                "Stage '{}' stopped heartbeating for {}s at {:.1}% progress.",
                current_stage,
                stale_for / 1000,
                progress_pct
            ))
            .execute(pool)
            .await
            .map_err(|error| error.to_string())?;
            upsert_alert(
                pool,
                Some(&job_id),
                None,
                "error",
                "stuck",
                "Ingestion appears stuck",
                &format!(
                    "Job has not advanced for {} seconds during '{}'.",
                    stale_for / 1000,
                    current_stage
                ),
                Some(json!({
                    "stage": current_stage,
                    "staleForMs": stale_for,
                    "thresholdMs": threshold,
                })),
            )
            .await?;
        } else {
            upsert_alert(
                pool,
                Some(&job_id),
                None,
                "warn",
                "suspected_stuck",
                "Ingestion is running long",
                &format!(
                    "Job has not heartbeated for {} seconds during '{}'.",
                    stale_for / 1000,
                    current_stage
                ),
                Some(json!({
                    "stage": current_stage,
                    "staleForMs": stale_for,
                    "thresholdMs": threshold,
                })),
            )
            .await?;
        }
    }
    Ok(())
}

async fn poll_dependency_health(active_job_count: i64) -> IngestHealthSnapshot {
    let checked_at = now_epoch_millis().unwrap_or_default();
    let ingestor = probe_json(
        "ingestor",
        "Ingestor",
        "http://localhost:8082/v1/health?check_dependencies=true",
    )
    .await;
    let rag = probe_json(
        "rag",
        "Retrieval",
        "http://localhost:8081/v1/health?check_dependencies=true",
    )
    .await;
    let overall_status = if ingestor.healthy && rag.healthy {
        "healthy"
    } else if ingestor.healthy || rag.healthy {
        "degraded"
    } else {
        "unhealthy"
    };
    IngestHealthSnapshot {
        checked_at,
        overall_status: overall_status.to_string(),
        active_job_count,
        probes: vec![ingestor, rag],
    }
}

fn blocking_ingest_probes<'a>(health: &'a IngestHealthSnapshot) -> Vec<&'a IngestHealthProbe> {
    let blocking = health
        .probes
        .iter()
        // Only ingestion-critical probes should pause extraction work.
        .filter(|probe| probe.id == "ingestor")
        .collect::<Vec<_>>();
    if blocking.is_empty() {
        health.probes.iter().collect()
    } else {
        blocking
    }
}

async fn probe_json(id: &str, label: &str, url: &str) -> IngestHealthProbe {
    let start = std::time::Instant::now();
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
    {
        Ok(client) => client,
        Err(error) => {
            return IngestHealthProbe {
                id: id.to_string(),
                label: label.to_string(),
                url: url.to_string(),
                status: "error".to_string(),
                healthy: false,
                latency_ms: None,
                message: format!("client init failed: {error}"),
                details: None,
            };
        }
    };

    match client.get(url).send().await {
        Ok(response) => {
            let latency_ms = start.elapsed().as_millis();
            let status_code = response.status();
            let body = response.text().await.unwrap_or_default();
            if !status_code.is_success() {
                return IngestHealthProbe {
                    id: id.to_string(),
                    label: label.to_string(),
                    url: url.to_string(),
                    status: "error".to_string(),
                    healthy: false,
                    latency_ms: Some(latency_ms),
                    message: format!("HTTP {}", status_code.as_u16()),
                    details: Some(json!({ "body": body })),
                };
            }

            let parsed = serde_json::from_str::<Value>(&body).ok();
            let healthy = parsed.as_ref().map(extract_probe_health).unwrap_or(true);
            let message = if healthy {
                parsed
                    .as_ref()
                    .map(extract_probe_message)
                    .unwrap_or_else(|| "service is up".to_string())
            } else {
                parsed
                    .as_ref()
                    .and_then(extract_unhealthy_detail)
                    .unwrap_or_else(|| "dependency health check reported an unhealthy subservice".to_string())
            };
            IngestHealthProbe {
                id: id.to_string(),
                label: label.to_string(),
                url: url.to_string(),
                status: if healthy {
                    "healthy".to_string()
                } else {
                    "degraded".to_string()
                },
                healthy,
                latency_ms: Some(latency_ms),
                message,
                details: parsed,
            }
        }
        Err(error) => IngestHealthProbe {
            id: id.to_string(),
            label: label.to_string(),
            url: url.to_string(),
            status: "error".to_string(),
            healthy: false,
            latency_ms: Some(start.elapsed().as_millis()),
            message: error.to_string(),
            details: None,
        },
    }
}

fn extract_probe_health(value: &Value) -> bool {
    match value {
        Value::Object(map) => {
            for (key, inner) in map {
                let key_lower = key.to_ascii_lowercase();
                if key_lower == "status" {
                    if let Some(text) = inner.as_str() {
                        let normalized = text.to_ascii_lowercase();
                        if normalized.contains("degraded")
                            || normalized.contains("error")
                            || normalized.contains("fail")
                            || normalized.contains("refused")
                            || normalized.contains("timeout")
                            || normalized.contains("unhealthy")
                        {
                            return false;
                        }
                    }
                }
                if !extract_probe_health(inner) && key_lower != "message" {
                    return false;
                }
            }
            true
        }
        Value::Array(items) => items.iter().all(extract_probe_health),
        _ => true,
    }
}

fn extract_probe_message(value: &Value) -> String {
    match value {
        Value::Object(map) => {
            if let Some(message) = map.get("message").and_then(Value::as_str) {
                return message.to_string();
            }
            if let Some(status) = map.get("status").and_then(Value::as_str) {
                return status.to_string();
            }
            "service is up".to_string()
        }
        _ => "service is up".to_string(),
    }
}

fn extract_unhealthy_detail(value: &Value) -> Option<String> {
    match value {
        Value::Object(map) => {
            let service = map
                .get("service")
                .and_then(Value::as_str)
                .map(str::to_string);
            let status = map.get("status").and_then(Value::as_str).map(str::to_string);
            let error = map.get("error").and_then(Value::as_str).map(str::to_string);
            if let Some(status_text) = status.as_deref() {
                let normalized = status_text.to_ascii_lowercase();
                if normalized.contains("degraded")
                    || normalized.contains("error")
                    || normalized.contains("fail")
                    || normalized.contains("refused")
                    || normalized.contains("timeout")
                    || normalized.contains("unhealthy")
                {
                    let label = service.unwrap_or_else(|| "dependency".to_string());
                    let detail = error.unwrap_or_else(|| status_text.to_string());
                    return Some(format!("{label}: {detail}"));
                }
            }

            for inner in map.values() {
                if let Some(detail) = extract_unhealthy_detail(inner) {
                    return Some(detail);
                }
            }
            None
        }
        Value::Array(items) => items.iter().find_map(extract_unhealthy_detail),
        _ => None,
    }
}

async fn list_jobs(pool: &SqlitePool) -> Result<Vec<IngestJobSummary>, String> {
    let rows = sqlx::query(
        "SELECT
            j.job_id, j.source_id, j.source_name, j.collection_name, j.status, j.current_stage,
            j.progress_pct, j.created_at, j.started_at, j.updated_at, j.ended_at, j.stage_started_at,
            j.last_heartbeat_at, j.worker_id, j.retry_count, j.error_code, j.error_message,
            j.detail_message, j.current_file_id,
            f.display_name AS current_file_name,
            COALESCE(file_totals.total_files, 0) AS total_files,
            COALESCE(file_totals.completed_files, 0) AS completed_files,
            COALESCE(file_totals.failed_files, 0) AS failed_files,
            COALESCE(alert_totals.active_alerts, 0) AS active_alerts
         FROM ingest_jobs j
         LEFT JOIN ingest_files f ON f.file_id = j.current_file_id
         LEFT JOIN (
            SELECT
                job_id,
                SUM(CASE WHEN status <> 'split' THEN 1 ELSE 0 END) AS total_files,
                SUM(CASE WHEN status IN ('completed', 'skipped', 'quarantined') THEN 1 ELSE 0 END) AS completed_files,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_files
            FROM ingest_files
            GROUP BY job_id
         ) file_totals ON file_totals.job_id = j.job_id
         LEFT JOIN (
            SELECT job_id, COUNT(*) AS active_alerts
            FROM ingest_alerts
            WHERE status = 'open'
            GROUP BY job_id
         ) alert_totals ON alert_totals.job_id = j.job_id
         ORDER BY j.created_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| IngestJobSummary {
            job_id: row.get("job_id"),
            source_id: row.get("source_id"),
            source_name: row.get("source_name"),
            collection_name: row.get("collection_name"),
            status: row.get("status"),
            current_stage: row.get("current_stage"),
            progress_pct: row.get("progress_pct"),
            created_at: row.get("created_at"),
            started_at: row.try_get("started_at").ok(),
            updated_at: row.get("updated_at"),
            ended_at: row.try_get("ended_at").ok(),
            stage_started_at: row.try_get("stage_started_at").ok(),
            last_heartbeat_at: row.try_get("last_heartbeat_at").ok(),
            worker_id: row.try_get("worker_id").ok(),
            retry_count: row.get("retry_count"),
            error_code: row.try_get("error_code").ok(),
            error_message: row.try_get("error_message").ok(),
            detail_message: row.try_get("detail_message").ok(),
            current_file_id: row.try_get("current_file_id").ok(),
            current_file_name: row.try_get("current_file_name").ok(),
            total_files: row.get("total_files"),
            completed_files: row.get("completed_files"),
            failed_files: row.get("failed_files"),
            active_alerts: row.get("active_alerts"),
        })
        .collect())
}

async fn list_active_files(pool: &SqlitePool) -> Result<Vec<IngestFileRecord>, String> {
    let rows = sqlx::query(
        "SELECT file_id, job_id, parent_file_id, source_path, staged_path, display_name, size_bytes, mime_type,
                page_count, page_range_start, page_range_end, status, current_stage, progress_pct,
                last_heartbeat_at, checkpoint_json, error_code, error_message, created_at, updated_at
         FROM ingest_files
         WHERE status NOT IN ('completed', 'skipped', 'quarantined', 'split')
         ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;
    Ok(rows.into_iter().map(row_to_file_record).collect())
}

async fn get_job_detail(pool: &SqlitePool, job_id: &str) -> Result<IngestJobDetail, String> {
    let job = list_jobs(pool)
        .await?
        .into_iter()
        .find(|job| job.job_id == job_id)
        .ok_or_else(|| format!("ingest job '{}' not found", job_id))?;

    let source_snapshot_raw = sqlx::query(
        "SELECT source_snapshot_json, options_json, checkpoint_json
         FROM ingest_jobs
         WHERE job_id = ?1",
    )
    .bind(job_id)
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())?;
    let source_snapshot =
        parse_optional_json(source_snapshot_raw.try_get("source_snapshot_json").ok())
            .unwrap_or(Value::Null);
    let options = parse_optional_json(source_snapshot_raw.try_get("options_json").ok())
        .unwrap_or(Value::Null);
    let checkpoint_json = parse_optional_json(source_snapshot_raw.try_get("checkpoint_json").ok());

    let file_rows = sqlx::query(
        "SELECT file_id, job_id, parent_file_id, source_path, staged_path, display_name, size_bytes, mime_type,
                page_count, page_range_start, page_range_end, status, current_stage, progress_pct,
                last_heartbeat_at, checkpoint_json, error_code, error_message, created_at, updated_at
         FROM ingest_files
         WHERE job_id = ?1
         ORDER BY created_at ASC, display_name COLLATE NOCASE ASC",
    )
    .bind(job_id)
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;

    let stage_run_rows = sqlx::query(
        "SELECT run_id, job_id, file_id, stage, status, progress_pct, detail_message, started_at, updated_at, ended_at, heartbeat_at
         FROM ingest_stage_runs
         WHERE job_id = ?1
         ORDER BY started_at DESC",
    )
    .bind(job_id)
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;

    let event_rows = sqlx::query(
        "SELECT event_id, job_id, file_id, level, kind, stage, message, payload_json, created_at
         FROM ingest_events
         WHERE job_id = ?1
         ORDER BY created_at DESC
         LIMIT 250",
    )
    .bind(job_id)
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;

    let alert_rows = sqlx::query(
        "SELECT alert_id, job_id, file_id, severity, kind, status, title, message, payload_json, created_at, updated_at, acknowledged_at
         FROM ingest_alerts
         WHERE job_id = ?1
         ORDER BY created_at DESC
         LIMIT 100",
    )
    .bind(job_id)
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(IngestJobDetail {
        job,
        source_snapshot,
        options,
        checkpoint_json,
        files: file_rows.into_iter().map(row_to_file_record).collect(),
        stage_runs: stage_run_rows
            .into_iter()
            .map(|row| IngestStageRunRecord {
                run_id: row.get("run_id"),
                job_id: row.get("job_id"),
                file_id: row.try_get("file_id").ok(),
                stage: row.get("stage"),
                status: row.get("status"),
                progress_pct: row.get("progress_pct"),
                detail_message: row.try_get("detail_message").ok(),
                started_at: row.get("started_at"),
                updated_at: row.get("updated_at"),
                ended_at: row.try_get("ended_at").ok(),
                heartbeat_at: row.try_get("heartbeat_at").ok(),
            })
            .collect(),
        events: event_rows
            .into_iter()
            .map(|row| IngestEventRecord {
                event_id: row.get("event_id"),
                job_id: row.get("job_id"),
                file_id: row.try_get("file_id").ok(),
                level: row.get("level"),
                kind: row.get("kind"),
                stage: row.try_get("stage").ok(),
                message: row.get("message"),
                payload_json: parse_optional_json(row.try_get("payload_json").ok()),
                created_at: row.get("created_at"),
            })
            .collect(),
        alerts: alert_rows
            .into_iter()
            .map(|row| IngestAlertRecord {
                alert_id: row.get("alert_id"),
                job_id: row.try_get("job_id").ok(),
                file_id: row.try_get("file_id").ok(),
                severity: row.get("severity"),
                kind: row.get("kind"),
                status: row.get("status"),
                title: row.get("title"),
                message: row.get("message"),
                payload_json: parse_optional_json(row.try_get("payload_json").ok()),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                acknowledged_at: row.try_get("acknowledged_at").ok(),
            })
            .collect(),
    })
}

async fn list_alerts(pool: &SqlitePool, limit: i64) -> Result<Vec<IngestAlertRecord>, String> {
    let rows = sqlx::query(
        "SELECT alert_id, job_id, file_id, severity, kind, status, title, message, payload_json, created_at, updated_at, acknowledged_at
         FROM ingest_alerts
         ORDER BY created_at DESC
         LIMIT ?1",
    )
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| IngestAlertRecord {
            alert_id: row.get("alert_id"),
            job_id: row.try_get("job_id").ok(),
            file_id: row.try_get("file_id").ok(),
            severity: row.get("severity"),
            kind: row.get("kind"),
            status: row.get("status"),
            title: row.get("title"),
            message: row.get("message"),
            payload_json: parse_optional_json(row.try_get("payload_json").ok()),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            acknowledged_at: row.try_get("acknowledged_at").ok(),
        })
        .collect())
}

async fn active_job_count(pool: &SqlitePool) -> Result<i64, String> {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM ingest_jobs WHERE status IN ('queued', 'running', 'paused', 'blocked', 'stuck')",
    )
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())
}

async fn upsert_alert(
    pool: &SqlitePool,
    job_id: Option<&str>,
    file_id: Option<&str>,
    severity: &str,
    kind: &str,
    title: &str,
    message: &str,
    payload: Option<Value>,
) -> Result<(), String> {
    let now = now_epoch_millis()?;
    let existing = sqlx::query(
        "SELECT alert_id
         FROM ingest_alerts
         WHERE kind = ?1
           AND status = 'open'
           AND ((job_id = ?2) OR (job_id IS NULL AND ?2 IS NULL))
           AND ((file_id = ?3) OR (file_id IS NULL AND ?3 IS NULL))
         ORDER BY created_at DESC
         LIMIT 1",
    )
    .bind(kind)
    .bind(job_id)
    .bind(file_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())?;

    if let Some(row) = existing {
        let alert_id: String = row.get("alert_id");
        sqlx::query(
            "UPDATE ingest_alerts
             SET severity = ?2, title = ?3, message = ?4, payload_json = ?5, updated_at = ?6
             WHERE alert_id = ?1",
        )
        .bind(alert_id)
        .bind(severity)
        .bind(title)
        .bind(message)
        .bind(payload.map(|value| value.to_string()))
        .bind(now)
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;
        return Ok(());
    }

    sqlx::query(
        "INSERT INTO ingest_alerts (
            alert_id, job_id, file_id, severity, kind, status, title, message, payload_json, created_at, updated_at, acknowledged_at
         ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, NULL
         )",
    )
    .bind(format!("ingest-alert-{}", Uuid::new_v4()))
    .bind(job_id)
    .bind(file_id)
    .bind(severity)
    .bind(kind)
    .bind(ALERT_STATUS_OPEN)
    .bind(title)
    .bind(message)
    .bind(payload.map(|value| value.to_string()))
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;
    Ok(())
}

async fn reset_file_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    file_id: &str,
    now: i64,
    detail: &str,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE ingest_files
         SET status = 'queued', current_stage = 'queued', progress_pct = 0, last_heartbeat_at = NULL,
             checkpoint_json = NULL, error_code = NULL, error_message = NULL, updated_at = ?2
         WHERE file_id = ?1",
    )
    .bind(file_id)
    .bind(now)
    .execute(&mut **tx)
    .await
    .map_err(|error| error.to_string())?;

    sqlx::query(
        "UPDATE ingest_stage_runs
         SET status = 'reset', updated_at = ?2, ended_at = ?2
         WHERE file_id = ?1 AND status IN ('running', 'failed')",
    )
    .bind(file_id)
    .bind(now)
    .execute(&mut **tx)
    .await
    .map_err(|error| error.to_string())?;

    sqlx::query(
        "INSERT INTO ingest_events (event_id, job_id, file_id, level, kind, stage, message, payload_json, created_at)
         SELECT ?1, job_id, file_id, 'info', 'file_reset', NULL, ?2, NULL, ?3
         FROM ingest_files
         WHERE file_id = ?4",
    )
    .bind(format!("ingest-event-{}", Uuid::new_v4()))
    .bind(detail)
    .bind(now)
    .bind(file_id)
    .execute(&mut **tx)
    .await
    .map_err(|error| error.to_string())?;
    Ok(())
}

async fn insert_event_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    job_id: &str,
    file_id: Option<&str>,
    level: &str,
    kind: &str,
    stage: Option<&str>,
    message: &str,
    payload: Option<Value>,
    created_at: i64,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO ingest_events (
            event_id, job_id, file_id, level, kind, stage, message, payload_json, created_at
         ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
         )",
    )
    .bind(format!("ingest-event-{}", Uuid::new_v4()))
    .bind(job_id)
    .bind(file_id)
    .bind(level)
    .bind(kind)
    .bind(stage)
    .bind(message)
    .bind(payload.map(|value| value.to_string()))
    .bind(created_at)
    .execute(&mut **tx)
    .await
    .map_err(|error| error.to_string())?;
    Ok(())
}

async fn insert_alert_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    job_id: Option<&str>,
    file_id: Option<&str>,
    severity: &str,
    kind: &str,
    status: &str,
    title: &str,
    message: &str,
    payload: Option<Value>,
    created_at: i64,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO ingest_alerts (
            alert_id, job_id, file_id, severity, kind, status, title, message, payload_json, created_at, updated_at, acknowledged_at
         ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, NULL
         )",
    )
    .bind(format!("ingest-alert-{}", Uuid::new_v4()))
    .bind(job_id)
    .bind(file_id)
    .bind(severity)
    .bind(kind)
    .bind(status)
    .bind(title)
    .bind(message)
    .bind(payload.map(|value| value.to_string()))
    .bind(created_at)
    .execute(&mut **tx)
    .await
    .map_err(|error| error.to_string())?;
    Ok(())
}

async fn open_pool(app: &AppHandle) -> Result<SqlitePool, String> {
    let app_config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("failed to resolve app config directory: {error}"))?;
    fs::create_dir_all(&app_config_dir)
        .map_err(|error| format!("failed to create app config directory: {error}"))?;
    let db_path = app_config_dir.join(crate::tools::db::DB_FILE_NAME);
    let db_url = format!("sqlite:{}", db_path.to_string_lossy());
    let pool = SqlitePool::connect(&db_url)
        .await
        .map_err(|error| format!("failed to open sqlite pool: {error}"))?;
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;
    if ingest_schema_missing(&pool).await? {
        execute_batch(
            &pool,
            include_str!("../migrations/0021_create_ingest_supervisor.sql"),
        )
        .await?;
    }
    if ingest_schema_needs_reconciliation(&pool).await? {
        execute_batch(
            &pool,
            include_str!("../migrations/0022_reconcile_ingest_supervisor_schema.sql"),
        )
        .await?;
    }
    Ok(pool)
}

async fn execute_batch(pool: &SqlitePool, sql_batch: &str) -> Result<(), String> {
    for statement in sql_batch.split(';') {
        let sql = statement.trim();
        if sql.is_empty() {
            continue;
        }
        sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

async fn ingest_schema_missing(pool: &SqlitePool) -> Result<bool, String> {
    let exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'ingest_jobs'",
    )
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())?;
    Ok(exists == 0)
}

async fn ingest_schema_needs_reconciliation(pool: &SqlitePool) -> Result<bool, String> {
    if ingest_schema_missing(pool).await? {
        return Ok(true);
    }

    let event_columns =
        sqlx::query_scalar::<_, String>("SELECT name FROM pragma_table_info('ingest_events')")
            .fetch_all(pool)
            .await
            .map_err(|error| error.to_string())?;
    let alert_columns =
        sqlx::query_scalar::<_, String>("SELECT name FROM pragma_table_info('ingest_alerts')")
            .fetch_all(pool)
            .await
            .map_err(|error| error.to_string())?;
    let stage_columns =
        sqlx::query_scalar::<_, String>("SELECT name FROM pragma_table_info('ingest_stage_runs')")
            .fetch_all(pool)
            .await
            .map_err(|error| error.to_string())?;

    Ok(!event_columns.iter().any(|column| column == "event_id")
        || !alert_columns.iter().any(|column| column == "alert_id")
        || !stage_columns.iter().any(|column| column == "run_id"))
}

fn enumerate_source(
    source: &IngestSourceSnapshot,
) -> Result<(Vec<EnumeratedFile>, EnumerateDiagnostics), String> {
    let path = PathBuf::from(source.path.trim());
    let allowed_extensions = normalize_extensions(&source.settings.allowed_extensions);
    let effective_include_patterns = if source.settings.include_patterns.is_empty() {
        allowed_extensions
            .iter()
            .flat_map(|extension| {
                let suffix = extension.trim_start_matches('.');
                [format!("*.{suffix}"), format!("**/*.{suffix}")]
            })
            .collect()
    } else {
        source.settings.include_patterns.clone()
    };
    let effective_exclude_patterns = source.settings.exclude_patterns.clone();
    let mut diagnostics = EnumerateDiagnostics {
        source_path: source.path.clone(),
        configured_source_type: source.source_type.clone(),
        resolved_source_mode: "missing".to_string(),
        candidate_file_count: 0,
        matched_file_count: 0,
        rejected_by_exclude: 0,
        rejected_by_extension: 0,
        rejected_by_size: 0,
        effective_include_patterns,
        effective_exclude_patterns: effective_exclude_patterns.clone(),
        allowed_extensions: allowed_extensions.iter().cloned().collect(),
        sample_rejections: Vec::new(),
    };

    if !path.exists() {
        diagnostics
            .sample_rejections
            .push("Source path does not exist.".to_string());
        return Ok((Vec::new(), diagnostics));
    }

    let max_file_size_bytes = source.settings.max_file_size_mb.max(1) * 1024 * 1024;
    let mut candidates = Vec::new();
    if path.is_file() {
        diagnostics.resolved_source_mode = "file".to_string();
        candidates.push(path.clone());
    } else {
        diagnostics.resolved_source_mode = "directory".to_string();
        walk_directory(
            &path,
            source.source_type != "file"
                && has_recursive_pattern(&diagnostics.effective_include_patterns),
            &mut candidates,
        )?;
    }
    diagnostics.candidate_file_count = candidates.len();

    let mut matched = Vec::new();
    for candidate in candidates {
        let metadata = match fs::metadata(&candidate) {
            Ok(metadata) => metadata,
            Err(error) => {
                push_rejection(
                    &mut diagnostics,
                    format!("{} => metadata error: {}", candidate.display(), error),
                );
                continue;
            }
        };
        if !metadata.is_file() {
            continue;
        }
        let relative = if path.is_dir() {
            candidate
                .strip_prefix(&path)
                .unwrap_or(candidate.as_path())
                .to_string_lossy()
                .replace('\\', "/")
        } else {
            candidate
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_string()
        };
        if is_excluded_path(&candidate, &relative, &effective_exclude_patterns) {
            diagnostics.rejected_by_exclude += 1;
            push_rejection(
                &mut diagnostics,
                format!("{} => excluded by temp/office rules", candidate.display()),
            );
            continue;
        }

        let extension = candidate
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| format!(".{}", value.to_ascii_lowercase()))
            .unwrap_or_default();
        if !allowed_extensions.is_empty() && !allowed_extensions.contains(&extension) {
            diagnostics.rejected_by_extension += 1;
            push_rejection(
                &mut diagnostics,
                format!(
                    "{} => unsupported extension {}",
                    candidate.display(),
                    extension
                ),
            );
            continue;
        }

        let size_bytes = metadata.len() as i64;
        if size_bytes > max_file_size_bytes {
            diagnostics.rejected_by_size += 1;
            push_rejection(
                &mut diagnostics,
                format!("{} => exceeds maxFileSizeMb", candidate.display()),
            );
            continue;
        }

        matched.push(EnumeratedFile {
            source_path: candidate.to_string_lossy().to_string(),
            display_name: candidate
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("document")
                .to_string(),
            size_bytes,
            mime_type: guess_mime_type(&candidate),
        });
    }

    diagnostics.matched_file_count = matched.len();
    Ok((matched, diagnostics))
}

fn walk_directory(path: &Path, recursive: bool, files: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = fs::read_dir(path).map_err(|error| error.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let entry_path = entry.path();
        if entry_path.is_dir() {
            if recursive {
                walk_directory(&entry_path, recursive, files)?;
            }
            continue;
        }
        files.push(entry_path);
    }
    Ok(())
}

fn has_recursive_pattern(patterns: &[String]) -> bool {
    patterns.iter().any(|pattern| pattern.contains("**"))
}

fn is_excluded_path(path: &Path, relative: &str, patterns: &[String]) -> bool {
    let relative_lower = relative.to_ascii_lowercase();
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    for pattern in patterns {
        let normalized = pattern.trim().to_ascii_lowercase();
        if normalized == "**/~$*" && file_name.starts_with("~$") {
            return true;
        }
        if normalized == "**/tmp/**" && relative_lower.split('/').any(|segment| segment == "tmp") {
            return true;
        }
        if normalized == "**/.tmp/**" && relative_lower.split('/').any(|segment| segment == ".tmp")
        {
            return true;
        }
    }
    false
}

fn normalize_extensions(values: &[String]) -> HashSet<String> {
    values
        .iter()
        .filter_map(|value| {
            let trimmed = value.trim().to_ascii_lowercase();
            if trimmed.is_empty() {
                None
            } else if trimmed.starts_with('.') {
                Some(trimmed)
            } else {
                Some(format!(".{trimmed}"))
            }
        })
        .collect()
}

fn sanitize_collection_name(value: &str) -> String {
    let mut sanitized = String::with_capacity(value.len());
    for character in value.trim().chars() {
        if character.is_ascii_alphanumeric() {
            sanitized.push(character.to_ascii_lowercase());
        } else if !sanitized.ends_with('_') {
            sanitized.push('_');
        }
    }
    let sanitized = sanitized.trim_matches('_').to_string();
    if sanitized.is_empty() {
        "sophon_ingest".to_string()
    } else {
        sanitized
    }
}

fn normalize_options(options: IngestJobOptions) -> IngestJobOptions {
    IngestJobOptions {
        dry_run: options.dry_run,
        safe_mode: options.safe_mode,
        max_workers: options.max_workers.clamp(1, 8),
    }
}

fn guess_mime_type(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_string_lossy().to_ascii_lowercase();
    let mime = match extension.as_str() {
        "pdf" => "application/pdf",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "dwg" => "application/acad",
        "dxf" => "image/vnd.dxf",
        "ifc" => "application/octet-stream",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "csv" => "text/csv",
        "txt" => "text/plain",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "md" => "text/markdown",
        _ => return None,
    };
    Some(mime.to_string())
}

fn parse_optional_json(value: Option<String>) -> Option<Value> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .and_then(|text| serde_json::from_str::<Value>(text).ok())
}

fn push_rejection(diagnostics: &mut EnumerateDiagnostics, message: String) {
    if diagnostics.sample_rejections.len() < 8 {
        diagnostics.sample_rejections.push(message);
    }
}

fn row_to_file_record(row: sqlx::sqlite::SqliteRow) -> IngestFileRecord {
    IngestFileRecord {
        file_id: row.get("file_id"),
        job_id: row.get("job_id"),
        parent_file_id: row.try_get("parent_file_id").ok(),
        source_path: row.get("source_path"),
        staged_path: row.try_get("staged_path").ok(),
        display_name: row.get("display_name"),
        size_bytes: row.get("size_bytes"),
        mime_type: row.try_get("mime_type").ok(),
        page_count: row.try_get("page_count").ok(),
        page_range_start: row.try_get("page_range_start").ok(),
        page_range_end: row.try_get("page_range_end").ok(),
        status: row.get("status"),
        current_stage: row.get("current_stage"),
        progress_pct: row.get("progress_pct"),
        last_heartbeat_at: row.try_get("last_heartbeat_at").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        checkpoint_json: parse_optional_json(row.try_get("checkpoint_json").ok()),
        error_code: row.try_get("error_code").ok(),
        error_message: row.try_get("error_message").ok(),
    }
}

fn stage_threshold_ms(stage: &str, size_bytes: Option<i64>, page_count: Option<i64>) -> i64 {
    match stage {
        "preflight" => 2 * 60 * 1000,
        "hashing" | "staging" | "extract_postprocess" | "verification" => 5 * 60 * 1000,
        "extract_dispatch" => 2 * 60 * 1000,
        "extract_running" => {
            let page_budget = (page_count.unwrap_or_default().max(1) / 25).max(1) * 60_000;
            let size_budget =
                (size_bytes.unwrap_or_default().max(1) / (20 * 1024 * 1024)).max(1) * 60_000;
            (10 * 60 * 1000).max(page_budget).max(size_budget)
        }
        "chunking" | "indexing" | "embedding" => 10 * 60 * 1000,
        _ => 5 * 60 * 1000,
    }
}

fn now_epoch_millis() -> Result<i64, String> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?;
    Ok(duration.as_millis() as i64)
}

fn default_max_workers() -> i64 {
    1
}

#[cfg(test)]
mod tests {
    use super::{
        blocking_ingest_probes, enumerate_source, extract_probe_health, extract_unhealthy_detail,
        sanitize_collection_name, IngestHealthProbe, IngestHealthSnapshot, IngestSourceSettings,
        IngestSourceSnapshot,
    };
    use serde_json::json;
    use sqlx::SqlitePool;
    use std::fs;
    use std::path::PathBuf;
    use uuid::Uuid;

    #[test]
    fn sanitize_collection_name_is_stable() {
        assert_eq!(
            sanitize_collection_name("Smoke Atlas 480Y/277 V"),
            "smoke_atlas_480y_277_v"
        );
        assert_eq!(sanitize_collection_name("___"), "sophon_ingest");
    }

    #[test]
    fn enumerate_source_respects_extensions_and_recursion() {
        let root = temp_dir("enumerate");
        let nested = root.join("nested");
        fs::create_dir_all(&nested).expect("create nested dir");
        fs::write(root.join("one.md"), "# hello").expect("write markdown");
        fs::write(root.join("two.PDF"), b"%PDF-1.4").expect("write pdf");
        fs::write(nested.join("three.csv"), "a,b").expect("write csv");
        fs::write(root.join("ignore.exe"), b"nope").expect("write exe");

        let source = IngestSourceSnapshot {
            source_id: "source-1".to_string(),
            source_name: "Fixture".to_string(),
            source_type: "folder".to_string(),
            path: root.to_string_lossy().to_string(),
            settings: IngestSourceSettings {
                include_patterns: vec![
                    "*.md".to_string(),
                    "*.pdf".to_string(),
                    "**/*.csv".to_string(),
                ],
                exclude_patterns: vec!["**/~$*".to_string()],
                allowed_extensions: vec![".md".to_string(), ".pdf".to_string(), ".csv".to_string()],
                max_file_size_mb: 10,
                max_pages: 500,
                watch_enabled: false,
                watch_interval_sec: 300,
                debounce_seconds: 20,
                chunk_size: 1024,
                chunk_overlap: 150,
                page_aware_chunking: true,
                ocr_enabled: true,
                extraction_enabled: true,
            },
        };

        let (files, diagnostics) = enumerate_source(&source).expect("enumerate source");
        let names = files
            .into_iter()
            .map(|file| file.display_name)
            .collect::<Vec<_>>();

        assert_eq!(diagnostics.matched_file_count, 3);
        assert!(names.contains(&"one.md".to_string()));
        assert!(names.contains(&"two.PDF".to_string()));
        assert!(names.contains(&"three.csv".to_string()));

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn ingest_schema_exposes_runtime_column_names() {
        tauri::async_runtime::block_on(async {
            let pool = SqlitePool::connect("sqlite::memory:")
                .await
                .expect("connect in-memory sqlite");

            super::execute_batch(
                &pool,
                include_str!("../migrations/0021_create_ingest_supervisor.sql"),
            )
            .await
            .expect("apply ingest migration 21");
            super::execute_batch(
                &pool,
                include_str!("../migrations/0022_reconcile_ingest_supervisor_schema.sql"),
            )
            .await
            .expect("apply ingest migration 22");

            let stage_run_columns = sqlx::query_scalar::<_, String>(
                "SELECT name FROM pragma_table_info('ingest_stage_runs') ORDER BY cid",
            )
            .fetch_all(&pool)
            .await
            .expect("read stage run columns");
            let event_columns = sqlx::query_scalar::<_, String>(
                "SELECT name FROM pragma_table_info('ingest_events') ORDER BY cid",
            )
            .fetch_all(&pool)
            .await
            .expect("read event columns");
            let alert_columns = sqlx::query_scalar::<_, String>(
                "SELECT name FROM pragma_table_info('ingest_alerts') ORDER BY cid",
            )
            .fetch_all(&pool)
            .await
            .expect("read alert columns");

            assert!(stage_run_columns.contains(&"run_id".to_string()));
            assert!(event_columns.contains(&"event_id".to_string()));
            assert!(event_columns.contains(&"kind".to_string()));
            assert!(alert_columns.contains(&"alert_id".to_string()));
            assert!(alert_columns.contains(&"kind".to_string()));
        });
    }

    #[test]
    fn health_parser_flags_nested_timeouts() {
        let payload = json!({
            "message": "Service is up.",
            "nim": [
                {
                    "service": "Reflection LLM",
                    "status": "timeout",
                    "error": "Request timed out after 5s"
                }
            ]
        });

        assert!(!extract_probe_health(&payload));
        assert_eq!(
            extract_unhealthy_detail(&payload).as_deref(),
            Some("Reflection LLM: Request timed out after 5s")
        );
    }

    #[test]
    fn ingest_blocking_probes_ignore_retrieval_only_failures() {
        let health = IngestHealthSnapshot {
            checked_at: 0,
            overall_status: "degraded".to_string(),
            active_job_count: 1,
            probes: vec![
                IngestHealthProbe {
                    id: "ingestor".to_string(),
                    label: "Ingestor".to_string(),
                    url: "http://localhost:8082".to_string(),
                    status: "healthy".to_string(),
                    healthy: true,
                    latency_ms: Some(4),
                    message: "Service is up.".to_string(),
                    details: None,
                },
                IngestHealthProbe {
                    id: "rag".to_string(),
                    label: "Retrieval".to_string(),
                    url: "http://localhost:8081".to_string(),
                    status: "degraded".to_string(),
                    healthy: false,
                    latency_ms: Some(9),
                    message: "Reflection LLM: Request timed out after 5s".to_string(),
                    details: None,
                },
            ],
        };

        let blocking = blocking_ingest_probes(&health);
        assert_eq!(blocking.len(), 1);
        assert_eq!(blocking[0].id, "ingestor");
        assert!(blocking[0].healthy);
    }

    fn temp_dir(prefix: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("korda-ingest-{}-{}", prefix, Uuid::new_v4()));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }
}
