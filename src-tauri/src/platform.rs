use crate::{ingest, sophon_runtime};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::sleep;

const STARTUP_EVENT_NAME: &str = "korda://startup/status";
const STARTUP_POLL_SECS: u64 = 15;

static STARTUP_STATE: OnceLock<Arc<StartupSupervisorState>> = OnceLock::new();

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppReleaseInfo {
    pub current_version: String,
    pub release_channel: String,
    pub updater_configured: bool,
    pub updater_endpoint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsBundle {
    pub path: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StartupStepStatus {
    pub id: String,
    pub label: String,
    pub status: String,
    pub message: String,
    pub last_updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeReadinessCheck {
    pub id: String,
    pub title: String,
    pub status: String,
    pub blocking: bool,
    pub message: String,
    #[serde(default)]
    pub remediation: Vec<String>,
    #[serde(default)]
    pub details: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeReadinessReport {
    pub state: String,
    pub summary: String,
    pub blocker_count: i64,
    pub warning_count: i64,
    #[serde(default)]
    pub checks: Vec<RuntimeReadinessCheck>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupStatusSnapshot {
    pub overall_status: String,
    pub message: String,
    pub last_updated_at: i64,
    pub last_attempted_at: Option<i64>,
    pub last_successful_startup_at: Option<i64>,
    pub startup_attempt_count: i64,
    pub auto_start_enabled: bool,
    pub app_data_dir: String,
    pub app_log_dir: String,
    pub diagnostics_dir: String,
    pub temp_dir: String,
    pub latest_diagnostics_path: Option<String>,
    pub last_error_summary: Option<String>,
    pub release: AppReleaseInfo,
    #[serde(default)]
    pub steps: Vec<StartupStepStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_readiness: Option<RuntimeReadinessReport>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ingest_health: Option<ingest::IngestHealthSnapshot>,
}

#[derive(Default)]
struct StartupControlState {
    retry_requested: bool,
    auto_stack_attempted: bool,
    last_stack_attempt_at: Option<i64>,
}

struct StartupSupervisorState {
    app: AppHandle,
    status: Mutex<StartupStatusSnapshot>,
    control: Mutex<StartupControlState>,
    run_in_progress: AtomicBool,
}

#[derive(Debug, Clone)]
struct RuntimePaths {
    app_data_dir: PathBuf,
    app_log_dir: PathBuf,
    diagnostics_dir: PathBuf,
    temp_dir: PathBuf,
    runtime_state_path: PathBuf,
}

pub fn setup(app: AppHandle) -> Result<(), String> {
    if STARTUP_STATE.get().is_some() {
        return Ok(());
    }
    let paths = ensure_runtime_paths(&app)?;
    let initial = StartupStatusSnapshot {
        overall_status: "initializing".to_string(),
        message: "Korda Tools is preparing local runtime services.".to_string(),
        last_updated_at: now_epoch_millis()?,
        last_attempted_at: None,
        last_successful_startup_at: None,
        startup_attempt_count: 0,
        auto_start_enabled: auto_start_enabled(),
        app_data_dir: paths.app_data_dir.to_string_lossy().to_string(),
        app_log_dir: paths.app_log_dir.to_string_lossy().to_string(),
        diagnostics_dir: paths.diagnostics_dir.to_string_lossy().to_string(),
        temp_dir: paths.temp_dir.to_string_lossy().to_string(),
        latest_diagnostics_path: None,
        last_error_summary: None,
        release: build_release_info(&app),
        steps: Vec::new(),
        runtime_readiness: None,
        ingest_health: None,
    };
    let state = Arc::new(StartupSupervisorState {
        app,
        status: Mutex::new(initial),
        control: Mutex::new(StartupControlState::default()),
        run_in_progress: AtomicBool::new(false),
    });
    STARTUP_STATE
        .set(state.clone())
        .map_err(|_| "startup supervisor already initialized".to_string())?;
    emit_status(&state)?;
    tauri::async_runtime::spawn(async move {
        run_startup_cycle(state.clone(), true).await;
        loop {
            sleep(Duration::from_secs(STARTUP_POLL_SECS)).await;
            run_startup_cycle(state.clone(), false).await;
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn app_get_release_info(app: AppHandle) -> Result<AppReleaseInfo, String> {
    Ok(build_release_info(&app))
}

#[tauri::command]
pub async fn app_get_startup_status(app: AppHandle) -> Result<StartupStatusSnapshot, String> {
    if let Some(state) = STARTUP_STATE.get() {
        return state
            .status
            .lock()
            .map(|value| value.clone())
            .map_err(|_| "startup status mutex poisoned".to_string());
    }
    let paths = ensure_runtime_paths(&app)?;
    Ok(StartupStatusSnapshot {
        overall_status: "initializing".to_string(),
        message: "Startup supervisor is initializing.".to_string(),
        last_updated_at: now_epoch_millis()?,
        last_attempted_at: None,
        last_successful_startup_at: None,
        startup_attempt_count: 0,
        auto_start_enabled: auto_start_enabled(),
        app_data_dir: paths.app_data_dir.to_string_lossy().to_string(),
        app_log_dir: paths.app_log_dir.to_string_lossy().to_string(),
        diagnostics_dir: paths.diagnostics_dir.to_string_lossy().to_string(),
        temp_dir: paths.temp_dir.to_string_lossy().to_string(),
        latest_diagnostics_path: None,
        last_error_summary: None,
        release: build_release_info(&app),
        steps: Vec::new(),
        runtime_readiness: None,
        ingest_health: None,
    })
}

#[tauri::command]
pub async fn app_retry_startup() -> Result<StartupStatusSnapshot, String> {
    let state = STARTUP_STATE
        .get()
        .ok_or_else(|| "startup supervisor is not initialized".to_string())?
        .clone();
    {
        let mut control = state
            .control
            .lock()
            .map_err(|_| "startup control mutex poisoned".to_string())?;
        control.retry_requested = true;
    }
    tauri::async_runtime::spawn(run_startup_cycle(state.clone(), true));
    state
        .status
        .lock()
        .map(|value| value.clone())
        .map_err(|_| "startup status mutex poisoned".to_string())
}

#[tauri::command]
pub async fn app_collect_diagnostics(app: AppHandle) -> Result<DiagnosticsBundle, String> {
    let paths = ensure_runtime_paths(&app)?;
    let created_at = now_epoch_millis()?;
    let startup_status = app_get_startup_status(app.clone()).await?;
    let health = ingest::current_health_snapshot(&app).await.ok();
    let runtime_state = read_json_if_exists(&paths.runtime_state_path);
    let docker_lines = capture_docker_ps().unwrap_or_default();
    let recent_log = read_latest_log_excerpt(&paths.app_log_dir);
    let diagnostics_path = paths
        .diagnostics_dir
        .join(format!("korda-diagnostics-{created_at}.json"));
    let payload = json!({
        "capturedAt": created_at,
        "release": build_release_info(&app),
        "startupStatus": startup_status,
        "ingestHealth": health,
        "runtimeStatePath": paths.runtime_state_path,
        "runtimeState": runtime_state,
        "dockerPs": docker_lines,
        "recentLogExcerpt": recent_log,
    });
    fs::write(
        &diagnostics_path,
        serde_json::to_vec_pretty(&payload).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;

    if let Some(state) = STARTUP_STATE.get() {
        let mut snapshot = state
            .status
            .lock()
            .map_err(|_| "startup status mutex poisoned".to_string())?
            .clone();
        snapshot.latest_diagnostics_path =
            Some(diagnostics_path.to_string_lossy().to_string());
        snapshot.last_updated_at = created_at;
        update_status(state, snapshot)?;
    }

    Ok(DiagnosticsBundle {
        path: diagnostics_path.to_string_lossy().to_string(),
        created_at,
    })
}

async fn run_startup_cycle(state: Arc<StartupSupervisorState>, forced: bool) {
    if state
        .run_in_progress
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    let run_result = run_startup_cycle_inner(&state, forced).await;
    if let Err(error) = run_result {
        let _ = apply_status_update(&state, |snapshot| {
            snapshot.overall_status = "blocked".to_string();
            snapshot.message = "Korda Tools startup is blocked.".to_string();
            snapshot.last_error_summary = Some(error.clone());
            snapshot.last_updated_at = now_epoch_millis().unwrap_or_default();
        });
        log::error!("startup supervisor cycle failed: {error}");
    }
    state.run_in_progress.store(false, Ordering::SeqCst);
}

async fn run_startup_cycle_inner(
    state: &Arc<StartupSupervisorState>,
    forced: bool,
) -> Result<(), String> {
    let attempt_started_at = now_epoch_millis()?;
    apply_status_update(state, |snapshot| {
        snapshot.overall_status = "initializing".to_string();
        snapshot.message = "Korda Tools is starting local runtime services.".to_string();
        snapshot.last_attempted_at = Some(attempt_started_at);
        snapshot.startup_attempt_count += 1;
        snapshot.last_updated_at = attempt_started_at;
        snapshot.release = build_release_info(&state.app);
    })?;

    let paths = ensure_runtime_paths(&state.app)?;
    let mut steps = vec![step(
        "paths",
        "App storage",
        "pass",
        "Application data, logs, diagnostics, and temp directories are available.",
        Some(json!({
            "appDataDir": paths.app_data_dir,
            "appLogDir": paths.app_log_dir,
            "diagnosticsDir": paths.diagnostics_dir,
            "tempDir": paths.temp_dir,
        })),
    )];

    let runtime_ready = tauri::async_runtime::spawn_blocking({
        let app = state.app.clone();
        move || sophon_runtime::ensure_started(&app)
    })
    .await
    .map_err(|error| error.to_string())?;

    if let Err(error) = runtime_ready {
        steps.push(step(
            "runtimeWorker",
            "Desktop runtime bridge",
            "fail",
            &error,
            None,
        ));
        let health = ingest::current_health_snapshot(&state.app).await.ok();
        return finalize_status(
            state,
            paths,
            steps,
            None,
            health,
            "blocked",
            "Korda Tools could not start the local Sophon runtime bridge.",
            Some(error),
        );
    }

    steps.push(step(
        "runtimeWorker",
        "Desktop runtime bridge",
        "pass",
        "The managed Sophon runtime worker is running.",
        None,
    ));

    let mut readiness = check_runtime_readiness(&state.app).await?;
    let mut managed_stack_step = build_managed_stack_step(&readiness, None);

    if readiness_blocks_on_services(&readiness) && should_attempt_stack_start(state, forced)? {
        let stack_result = tauri::async_runtime::spawn_blocking({
            let app = state.app.clone();
            move || start_managed_stack(&app)
        })
        .await
        .map_err(|error| error.to_string())?;

        match stack_result {
            Ok(message) => {
                managed_stack_step = build_managed_stack_step(&readiness, Some(message));
                readiness = check_runtime_readiness(&state.app).await?;
            }
            Err(error) => {
                managed_stack_step = step(
                    "managedStack",
                    "Managed local services",
                    "fail",
                    &error,
                    None,
                );
            }
        }
    }

    steps.push(managed_stack_step);
    steps.push(step(
        "runtimeReadiness",
        "Runtime readiness",
        readiness.state.as_str(),
        &readiness.summary,
        Some(
            serde_json::to_value(&readiness).map_err(|error| error.to_string())?,
        ),
    ));

    let health = ingest::current_health_snapshot(&state.app).await.ok();
    let overall_status = match readiness.state.as_str() {
        "ready" => "ready",
        "degraded" => "degraded",
        _ => "blocked",
    };
    let error_summary = if overall_status == "blocked" {
        Some(readiness.summary.clone())
    } else {
        None
    };

    finalize_status(
        state,
        paths,
        steps,
        Some(readiness.clone()),
        health,
        overall_status,
        &readiness.summary,
        error_summary,
    )
}

fn finalize_status(
    state: &Arc<StartupSupervisorState>,
    paths: RuntimePaths,
    steps: Vec<StartupStepStatus>,
    readiness: Option<RuntimeReadinessReport>,
    health: Option<ingest::IngestHealthSnapshot>,
    overall_status: &str,
    message: &str,
    error_summary: Option<String>,
) -> Result<(), String> {
    let now = now_epoch_millis()?;
    apply_status_update(state, |snapshot| {
        snapshot.overall_status = overall_status.to_string();
        snapshot.message = message.to_string();
        snapshot.steps = steps;
        snapshot.runtime_readiness = readiness;
        snapshot.ingest_health = health;
        snapshot.last_error_summary = error_summary;
        snapshot.last_updated_at = now;
        snapshot.app_data_dir = paths.app_data_dir.to_string_lossy().to_string();
        snapshot.app_log_dir = paths.app_log_dir.to_string_lossy().to_string();
        snapshot.diagnostics_dir = paths.diagnostics_dir.to_string_lossy().to_string();
        snapshot.temp_dir = paths.temp_dir.to_string_lossy().to_string();
        if overall_status != "blocked" {
            snapshot.last_successful_startup_at = Some(now);
        }
    })
}

fn build_release_info(app: &AppHandle) -> AppReleaseInfo {
    let default_channel = if cfg!(debug_assertions) {
        "development"
    } else {
        "internal"
    };
    let release_channel = option_env!("KORDA_RELEASE_CHANNEL")
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(default_channel)
        .to_string();
    let updater_endpoint = option_env!("TAURI_UPDATER_ENDPOINT")
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            Some(
                "https://github.com/Matt-Harrington1650/korda-tools/releases/latest/download/latest.json"
                    .to_string(),
            )
        });
    let updater_configured = option_env!("TAURI_UPDATER_PUBLIC_KEY")
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some();

    AppReleaseInfo {
        current_version: app.package_info().version.to_string(),
        release_channel,
        updater_configured,
        updater_endpoint,
    }
}

fn step(
    id: &str,
    label: &str,
    status: &str,
    message: &str,
    details: Option<Value>,
) -> StartupStepStatus {
    StartupStepStatus {
        id: id.to_string(),
        label: label.to_string(),
        status: status.to_string(),
        message: message.to_string(),
        last_updated_at: now_epoch_millis().unwrap_or_default(),
        details,
    }
}

fn ensure_runtime_paths(app: &AppHandle) -> Result<RuntimePaths, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app_data_dir: {error}"))?;
    let app_log_dir = app
        .path()
        .app_log_dir()
        .map_err(|error| format!("failed to resolve app_log_dir: {error}"))?;
    let diagnostics_dir = app_log_dir.join("diagnostics");
    let temp_dir = app_data_dir.join("sophon-tmp");
    for path in [&app_data_dir, &app_log_dir, &diagnostics_dir, &temp_dir] {
        fs::create_dir_all(path)
            .map_err(|error| format!("failed to create {}: {error}", path.to_string_lossy()))?;
    }
    Ok(RuntimePaths {
        runtime_state_path: app_data_dir.join("sophon_runtime_state.json"),
        app_data_dir,
        app_log_dir,
        diagnostics_dir,
        temp_dir,
    })
}

async fn check_runtime_readiness(app: &AppHandle) -> Result<RuntimeReadinessReport, String> {
    let value = tauri::async_runtime::spawn_blocking({
        let app = app.clone();
        move || sophon_runtime::invoke_internal(&app, "check_readiness", Value::Null)
    })
    .await
    .map_err(|error| error.to_string())??;

    serde_json::from_value::<RuntimeReadinessReport>(value)
        .map_err(|error| format!("failed to parse readiness report: {error}"))
}

fn build_managed_stack_step(
    readiness: &RuntimeReadinessReport,
    start_message: Option<String>,
) -> StartupStepStatus {
    if !readiness_blocks_on_services(readiness) {
        return step(
            "managedStack",
            "Managed local services",
            "pass",
            start_message
                .as_deref()
                .unwrap_or("Managed services are already healthy."),
            None,
        );
    }

    if let Some(message) = start_message {
        return step(
            "managedStack",
            "Managed local services",
            "warn",
            &message,
            None,
        );
    }

    let service_checks = readiness
        .checks
        .iter()
        .filter(|check| {
            matches!(
                check.id.as_str(),
                "ingestor_dependencies" | "rag_dependencies" | "collection_bootstrap"
            )
        })
        .map(|check| check.message.clone())
        .collect::<Vec<_>>();

    step(
        "managedStack",
        "Managed local services",
        "warn",
        &service_checks.join(" | "),
        None,
    )
}

fn readiness_blocks_on_services(readiness: &RuntimeReadinessReport) -> bool {
    readiness.checks.iter().any(|check| {
        check.status == "fail"
            && matches!(
                check.id.as_str(),
                "ingestor_dependencies" | "rag_dependencies" | "collection_bootstrap"
            )
    })
}

fn should_attempt_stack_start(
    state: &Arc<StartupSupervisorState>,
    forced: bool,
) -> Result<bool, String> {
    if !auto_start_enabled() {
        return Ok(false);
    }

    let mut control = state
        .control
        .lock()
        .map_err(|_| "startup control mutex poisoned".to_string())?;
    if forced || control.retry_requested {
        control.retry_requested = false;
        control.auto_stack_attempted = true;
        control.last_stack_attempt_at = Some(now_epoch_millis()?);
        return Ok(true);
    }
    if control.auto_stack_attempted {
        return Ok(false);
    }
    control.auto_stack_attempted = true;
    control.last_stack_attempt_at = Some(now_epoch_millis()?);
    Ok(true)
}

fn auto_start_enabled() -> bool {
    !matches!(
        std::env::var("KORDA_MANAGED_STACK_AUTOSTART")
            .unwrap_or_else(|_| "true".to_string())
            .trim()
            .to_ascii_lowercase()
            .as_str(),
        "0" | "false" | "no" | "off"
    )
}

fn start_managed_stack(_app: &AppHandle) -> Result<String, String> {
    let root = sophon_runtime::resolve_korda_rag_root().ok_or_else(|| {
        "Managed runtime root not found. Set SOPHON_KORDA_RAG_ROOT or install the internal runtime bundle."
            .to_string()
    })?;

    let compose_files = [
        root.join("deploy").join("compose").join("vectordb.yaml"),
        root.join("deploy")
            .join("compose")
            .join("docker-compose-rag-server.yaml"),
        root.join("deploy")
            .join("compose")
            .join("docker-compose-ingestor-server.yaml"),
    ];
    for file in &compose_files {
        if !file.exists() {
            return Err(format!(
                "Managed runtime compose file is missing: {}",
                file.to_string_lossy()
            ));
        }
    }

    let docker_check = Command::new("docker")
        .args(["compose", "version"])
        .output()
        .map_err(|error| format!("docker compose is not available: {error}"))?;
    if !docker_check.status.success() {
        return Err(format!(
            "docker compose is not available: {}",
            String::from_utf8_lossy(&docker_check.stderr)
        ));
    }

    let mut command = Command::new("docker");
    command.current_dir(&root);
    command.arg("compose");
    for file in &compose_files {
        command.arg("-f").arg(file);
    }
    command.args(["up", "-d", "--remove-orphans"]);
    if let Some(api_key) = sophon_runtime::read_sophon_api_key() {
        command.env("NGC_API_KEY", &api_key);
        command.env("NVIDIA_API_KEY", &api_key);
    }
    command.env("PWD", &root);

    let output = command
        .output()
        .map_err(|error| format!("failed to start managed local services: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !output.status.success() {
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(format!("docker compose up failed: {detail}"));
    }

    let detail = if stdout.is_empty() {
        "Managed local services are starting.".to_string()
    } else {
        stdout
    };
    log::info!("managed local services started from {}", root.to_string_lossy());
    Ok(detail)
}

fn capture_docker_ps() -> Result<Vec<String>, String> {
    let output = Command::new("docker")
        .args(["ps", "--format", "{{.Names}} | {{.Status}}"])
        .output()
        .map_err(|error| format!("docker ps failed: {error}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect())
}

fn read_json_if_exists(path: &Path) -> Option<Value> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str::<Value>(&raw).ok()
}

fn read_latest_log_excerpt(log_dir: &Path) -> Option<Value> {
    let mut entries = fs::read_dir(log_dir)
        .ok()?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().extension().and_then(|value| value.to_str()) == Some("log"))
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| {
        entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .ok()
    });
    let latest = entries.pop()?;
    let path = latest.path();
    let contents = fs::read_to_string(&path).ok()?;
    let lines = contents
        .lines()
        .rev()
        .take(120)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .map(str::to_string)
        .collect::<Vec<_>>();
    Some(json!({
        "path": path,
        "lines": lines,
    }))
}

fn apply_status_update<F>(state: &Arc<StartupSupervisorState>, updater: F) -> Result<(), String>
where
    F: FnOnce(&mut StartupStatusSnapshot),
{
    let snapshot = {
        let mut guard = state
            .status
            .lock()
            .map_err(|_| "startup status mutex poisoned".to_string())?;
        updater(&mut guard);
        guard.clone()
    };
    update_status(state, snapshot)
}

fn update_status(
    state: &Arc<StartupSupervisorState>,
    snapshot: StartupStatusSnapshot,
) -> Result<(), String> {
    {
        let mut guard = state
            .status
            .lock()
            .map_err(|_| "startup status mutex poisoned".to_string())?;
        *guard = snapshot.clone();
    }
    state
        .app
        .emit(STARTUP_EVENT_NAME, snapshot)
        .map_err(|error| error.to_string())
}

fn emit_status(state: &Arc<StartupSupervisorState>) -> Result<(), String> {
    let snapshot = state
        .status
        .lock()
        .map_err(|_| "startup status mutex poisoned".to_string())?
        .clone();
    state
        .app
        .emit(STARTUP_EVENT_NAME, snapshot)
        .map_err(|error| error.to_string())
}

fn now_epoch_millis() -> Result<i64, String> {
    Ok(std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis() as i64)
}
