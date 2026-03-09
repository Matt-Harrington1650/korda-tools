use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Manager};

static RUNTIME_MANAGER: OnceLock<Mutex<SophonRuntimeManager>> = OnceLock::new();
const KEYRING_SERVICE_NAME: &str = "korda-tools";
const SOPHON_NVIDIA_API_KEY_CREDENTIAL_ID: &str = "sophon.nvidia.api_key";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SophonRuntimeInvokeRequest {
    pub method: String,
    #[serde(default)]
    pub params: Value,
}

#[derive(Debug, Deserialize)]
struct SophonRuntimeEnvelope {
    id: u64,
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Default)]
struct SophonRuntimeManager {
    process: Option<SophonRuntimeProcess>,
}

struct SophonRuntimeProcess {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    next_id: u64,
}

impl SophonRuntimeProcess {
    fn call(&mut self, method: &str, params: Value) -> Result<Value, String> {
        self.next_id = self.next_id.saturating_add(1);
        let request_id = self.next_id;
        let request_payload = json!({
            "id": request_id,
            "method": method,
            "params": params,
        });

        writeln!(self.stdin, "{request_payload}")
            .map_err(|error| format!("failed to send request to Sophon runtime: {error}"))?;
        self.stdin
            .flush()
            .map_err(|error| format!("failed to flush Sophon runtime stdin: {error}"))?;

        let mut line = String::new();
        loop {
            line.clear();
            let bytes = self
                .stdout
                .read_line(&mut line)
                .map_err(|error| format!("failed to read Sophon runtime output: {error}"))?;
            if bytes == 0 {
                return Err("Sophon runtime worker exited unexpectedly.".to_string());
            }
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            let envelope = match serde_json::from_str::<SophonRuntimeEnvelope>(trimmed) {
                Ok(parsed) => parsed,
                Err(_) => {
                    continue;
                }
            };
            if envelope.id != request_id {
                continue;
            }
            if let Some(error) = envelope.error {
                return Err(error);
            }
            return Ok(envelope.result.unwrap_or(Value::Null));
        }
    }
}

impl SophonRuntimeManager {
    fn invoke(&mut self, app: &AppHandle, method: &str, params: Value) -> Result<Value, String> {
        self.ensure_worker(app)?;
        let call_result = self
            .process
            .as_mut()
            .ok_or_else(|| "Sophon runtime worker is unavailable.".to_string())?
            .call(method, params.clone());
        if call_result.is_ok() {
            return call_result;
        }

        self.process = None;
        self.ensure_worker(app)?;
        self.process
            .as_mut()
            .ok_or_else(|| "Sophon runtime worker is unavailable.".to_string())?
            .call(method, params)
    }

    fn shutdown(&mut self) {
        if let Some(mut process) = self.process.take() {
            let _ = process.call("shutdown", Value::Null);
            let _ = process.child.kill();
            let _ = process.child.wait();
        }
    }

    fn ensure_worker(&mut self, app: &AppHandle) -> Result<(), String> {
        let worker_is_alive = match self.process.as_mut() {
            Some(process) => match process.child.try_wait() {
                Ok(None) => true,
                Ok(Some(_)) => false,
                Err(_) => false,
            },
            None => false,
        };
        if worker_is_alive {
            return Ok(());
        }
        self.process = Some(spawn_worker(app)?);
        Ok(())
    }
}

fn runtime_manager() -> &'static Mutex<SophonRuntimeManager> {
    RUNTIME_MANAGER.get_or_init(|| Mutex::new(SophonRuntimeManager::default()))
}

fn resolve_worker_script_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("scripts")
        .join("sophon_runtime_worker.py");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("failed to resolve resource_dir: {error}"))?;
    let resource_candidates = [
        resource_dir.join("sophon_runtime_worker.py"),
        resource_dir
            .join("scripts")
            .join("sophon_runtime_worker.py"),
    ];
    for candidate in resource_candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err("unable to locate sophon_runtime_worker.py".to_string())
}

fn resolve_korda_rag_src() -> Option<PathBuf> {
    if let Ok(explicit) = std::env::var("SOPHON_KORDA_RAG_SRC") {
        let path = PathBuf::from(explicit);
        if path.exists() {
            return Some(path);
        }
    }

    let default_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("KORDA-RAG")
        .join("src");
    if default_path.exists() {
        return Some(default_path);
    }
    None
}

fn read_sophon_api_key() -> Option<String> {
    for env_name in ["SOPHON_NVIDIA_API_KEY", "NVIDIA_API_KEY", "NGC_API_KEY"] {
        if let Ok(value) = std::env::var(env_name) {
            let trimmed = value.trim().to_string();
            if !trimmed.is_empty() {
                return Some(trimmed);
            }
        }
    }

    let entry =
        keyring::Entry::new(KEYRING_SERVICE_NAME, SOPHON_NVIDIA_API_KEY_CREDENTIAL_ID).ok()?;
    let secret = entry.get_password().ok()?;
    let trimmed = secret.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn resolve_positive_env_or_default(key: &str, default_value: &str) -> String {
    std::env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .filter(|value| {
            value
                .parse::<u64>()
                .map(|parsed| parsed > 0)
                .unwrap_or(false)
        })
        .unwrap_or_else(|| default_value.to_string())
}

fn resolve_worker_temp_dir(app_data_dir: &Path) -> Result<String, String> {
    if let Ok(explicit) = std::env::var("TEMP_DIR") {
        let trimmed = explicit.trim();
        if !trimmed.is_empty() {
            let explicit_path = PathBuf::from(trimmed);
            fs::create_dir_all(&explicit_path).map_err(|error| {
                format!(
                    "failed to create TEMP_DIR for Sophon runtime ({}): {error}",
                    explicit_path.to_string_lossy()
                )
            })?;
            return Ok(explicit_path.to_string_lossy().to_string());
        }
    }

    let fallback = app_data_dir.join("sophon-tmp");
    fs::create_dir_all(&fallback).map_err(|error| {
        format!(
            "failed to create fallback temp dir for Sophon runtime ({}): {error}",
            fallback.to_string_lossy()
        )
    })?;
    Ok(fallback.to_string_lossy().to_string())
}

fn spawn_worker(app: &AppHandle) -> Result<SophonRuntimeProcess, String> {
    let script_path = resolve_worker_script_path(app)?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app_data_dir: {error}"))?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("failed to create app_data_dir for Sophon runtime: {error}"))?;
    let temp_dir = resolve_worker_temp_dir(&app_data_dir)?;

    let script_arg = script_path.to_string_lossy().to_string();
    let mut candidates: Vec<(String, Vec<String>)> = Vec::new();
    if let Ok(custom_python) = std::env::var("SOPHON_PYTHON_BIN") {
        if !custom_python.trim().is_empty() {
            candidates.push((custom_python, vec!["-u".to_string(), script_arg.clone()]));
        }
    }
    if cfg!(windows) {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let local_python_bin = PathBuf::from(&local_app_data)
                .join("Python")
                .join("bin")
                .join("python.exe");
            if local_python_bin.exists() {
                candidates.push((
                    local_python_bin.to_string_lossy().to_string(),
                    vec!["-u".to_string(), script_arg.clone()],
                ));
            }

            for version in ["3.12", "3.11", "3.10"] {
                let local_core = PathBuf::from(&local_app_data)
                    .join("Python")
                    .join(format!("pythoncore-{version}-64"))
                    .join("python.exe");
                if local_core.exists() {
                    candidates.push((
                        local_core.to_string_lossy().to_string(),
                        vec!["-u".to_string(), script_arg.clone()],
                    ));
                }
            }
        }

        candidates.push((
            "py".to_string(),
            vec!["-3.12".to_string(), "-u".to_string(), script_arg.clone()],
        ));
        candidates.push((
            "py".to_string(),
            vec!["-3.11".to_string(), "-u".to_string(), script_arg.clone()],
        ));
        candidates.push((
            "py".to_string(),
            vec!["-3".to_string(), "-u".to_string(), script_arg.clone()],
        ));
    }
    candidates.push(("python".to_string(), vec!["-u".to_string(), script_arg]));

    let mut startup_errors = Vec::new();
    let bridge_init_timeout =
        resolve_positive_env_or_default("SOPHON_BRIDGE_INIT_TIMEOUT_SEC", "180");
    let bridge_client_init_timeout =
        resolve_positive_env_or_default("SOPHON_BRIDGE_CLIENT_INIT_TIMEOUT_SEC", "180");
    let ingest_pending_timeout =
        resolve_positive_env_or_default("SOPHON_INGEST_PENDING_TIMEOUT_SEC", "900");
    for (program, args) in candidates {
        let mut command = Command::new(&program);
        command.args(&args);
        command.stdin(Stdio::piped());
        command.stdout(Stdio::piped());
        command.stderr(Stdio::inherit());
        command.env("SOPHON_APP_DATA_DIR", app_data_dir.as_os_str());
        command.env("TEMP_DIR", &temp_dir);
        command.env("TMPDIR", &temp_dir);
        command.env("TMP", &temp_dir);
        command.env("TEMP", &temp_dir);
        if let Some(korda_rag_src) = resolve_korda_rag_src() {
            command.env("SOPHON_KORDA_RAG_SRC", korda_rag_src.as_os_str());
        }
        if let Some(api_key) = read_sophon_api_key() {
            command.env("NVIDIA_API_KEY", &api_key);
            command.env("NGC_API_KEY", &api_key);
        }
        command.env("SOPHON_BRIDGE_INIT_TIMEOUT_SEC", &bridge_init_timeout);
        command.env(
            "SOPHON_BRIDGE_CLIENT_INIT_TIMEOUT_SEC",
            &bridge_client_init_timeout,
        );
        command.env("SOPHON_INGEST_PENDING_TIMEOUT_SEC", &ingest_pending_timeout);
        // Balanced defaults: private IPC remains enforced while NVIDIA hosted inferencing is allowed.
        command.env("APP_LLM_SERVERURL", "");
        command.env(
            "APP_EMBEDDINGS_SERVERURL",
            "https://integrate.api.nvidia.com/v1",
        );
        command.env("APP_RANKING_SERVERURL", "");
        command.env("APP_QUERYREWRITER_SERVERURL", "");
        command.env("APP_FILTEREXPRESSIONGENERATOR_SERVERURL", "");
        command.env("SUMMARY_LLM_SERVERURL", "");
        command.env("ENABLE_QUERYREWRITER", "true");
        command.env("ENABLE_FILTER_GENERATOR", "true");

        match command.spawn() {
            Ok(mut child) => {
                let stdin = child
                    .stdin
                    .take()
                    .ok_or_else(|| "failed to acquire Sophon runtime stdin".to_string())?;
                let stdout = child
                    .stdout
                    .take()
                    .ok_or_else(|| "failed to acquire Sophon runtime stdout".to_string())?;
                let mut process = SophonRuntimeProcess {
                    child,
                    stdin,
                    stdout: BufReader::new(stdout),
                    next_id: 0,
                };
                match process.call("ping", Value::Null) {
                    Ok(_) => return Ok(process),
                    Err(error) => {
                        let _ = process.child.kill();
                        let _ = process.child.wait();
                        startup_errors
                            .push(format!("worker startup failed using `{program}`: {error}"));
                    }
                }
            }
            Err(error) => {
                startup_errors.push(format!("failed to spawn `{program}`: {error}"));
            }
        }
    }

    Err(format!(
        "unable to start Sophon runtime worker. Attempts: {}",
        startup_errors.join(" | ")
    ))
}

#[tauri::command]
pub async fn sophon_runtime_invoke(
    app: AppHandle,
    request: SophonRuntimeInvokeRequest,
) -> Result<Value, String> {
    let method = request.method.trim().to_string();
    if method.is_empty() {
        return Err("Sophon runtime method is required.".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let manager = runtime_manager();
        let mut guard = manager
            .lock()
            .map_err(|_| "failed to lock Sophon runtime manager".to_string())?;
        guard.invoke(&app, &method, request.params)
    })
    .await
    .map_err(|error| format!("Sophon runtime task join error: {error}"))?
}

#[tauri::command]
pub async fn sophon_runtime_shutdown() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = runtime_manager();
        let mut guard = manager
            .lock()
            .map_err(|_| "failed to lock Sophon runtime manager".to_string())?;
        guard.shutdown();
        Ok(())
    })
    .await
    .map_err(|error| format!("Sophon runtime shutdown join error: {error}"))?
}
