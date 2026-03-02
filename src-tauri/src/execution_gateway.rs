use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::{Client, Method, Url};
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use tauri::{AppHandle, Manager};

const MIN_TIMEOUT_MS: u64 = 1_000;
const MAX_TIMEOUT_MS: u64 = 60_000;
const DEFAULT_TIMEOUT_MS: u64 = 10_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GovernanceContextRequest {
    pub workspace_id: String,
    pub project_id: String,
    pub actor_id: String,
    pub sensitivity_level: String,
    pub external_ai_override_id: Option<String>,
    pub provider_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionGatewayRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub timeout_ms: u64,
    pub tool_type: Option<String>,
    pub governance_context: Option<GovernanceContextRequest>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionGatewayResponse {
    pub status_code: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}

#[tauri::command]
pub async fn execution_gateway_http_request(
    app: AppHandle,
    request: ExecutionGatewayRequest,
) -> Result<ExecutionGatewayResponse, String> {
    let method = Method::from_bytes(request.method.trim().as_bytes())
        .map_err(|error| format!("invalid HTTP method: {error}"))?;
    let url = validate_url_and_policy(&app, &request).await?;
    let timeout_ms = clamp_timeout_ms(request.timeout_ms);
    let headers = build_headers(&request.headers)?;

    let client = Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|error| format!("failed to create HTTP client: {error}"))?;

    let mut outbound = client.request(method, url).headers(headers);
    if let Some(body) = request.body {
        outbound = outbound.body(body);
    }

    let response = outbound
        .send()
        .await
        .map_err(|error| format!("gateway request failed: {error}"))?;
    let status_code = response.status().as_u16();
    let mut response_headers = HashMap::new();
    for (name, value) in response.headers().iter() {
        if let Ok(value_text) = value.to_str() {
            response_headers.insert(name.as_str().to_string(), value_text.to_string());
        }
    }
    let body = response
        .text()
        .await
        .map_err(|error| format!("failed to read gateway response body: {error}"))?;

    Ok(ExecutionGatewayResponse {
        status_code,
        headers: response_headers,
        body,
    })
}

async fn validate_url_and_policy(
    app: &AppHandle,
    request: &ExecutionGatewayRequest,
) -> Result<Url, String> {
    let url = Url::parse(request.url.trim()).map_err(|error| format!("invalid URL: {error}"))?;
    let host = url
        .host_str()
        .ok_or_else(|| "URL host is required.".to_string())?
        .to_ascii_lowercase();

    match url.scheme() {
        "https" => {}
        "http" if host == "localhost" || host == "127.0.0.1" => {}
        _ => {
            return Err(
                "only HTTPS (or localhost HTTP for development) is allowed by execution gateway."
                    .to_string(),
            )
        }
    }

    if request
        .tool_type
        .as_deref()
        .map(|value| value == "openai_compatible")
        .unwrap_or(false)
    {
        let governance = request.governance_context.as_ref().ok_or_else(|| {
            "EXTERNAL_AI_CONTEXT_REQUIRED: governance context is required.".to_string()
        })?;

        if governance.workspace_id.trim().is_empty()
            || governance.project_id.trim().is_empty()
            || governance.actor_id.trim().is_empty()
        {
            return Err(
                "EXTERNAL_AI_CONTEXT_REQUIRED: workspace/project/actor identifiers are required."
                    .to_string(),
            );
        }
        if governance.sensitivity_level.trim().is_empty() {
            return Err(
                "EXTERNAL_AI_CONTEXT_REQUIRED: sensitivity classification is required.".to_string(),
            );
        }

        if !is_allowed_external_ai_host(&host) {
            return Err(format!(
                "external AI host is not in the approved allowlist: {host}"
            ));
        }

        enforce_external_ai_policy(app, governance, &host).await?;
    }

    Ok(url)
}

async fn enforce_external_ai_policy(
    app: &AppHandle,
    governance: &GovernanceContextRequest,
    host: &str,
) -> Result<(), String> {
    let workspace_id = governance.workspace_id.trim();
    let project_id = governance.project_id.trim();
    let actor_id = governance.actor_id.trim();
    let provider_id = governance
        .provider_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_else(|| host.to_string());
    let scope_sensitivity = normalize_sensitivity_level(&governance.sensitivity_level)?;
    let override_id = governance
        .external_ai_override_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    if provider_id != host {
        return Err(
            "EXTERNAL_AI_PROVIDER_MISMATCH: governance provider_id must match outbound host."
                .to_string(),
        );
    }

    let db_path = resolve_policy_db_path(app)?;
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            SqliteConnectOptions::new()
                .filename(&db_path)
                .create_if_missing(false),
        )
        .await
        .map_err(|error| {
            format!(
                "POLICY_DB_UNAVAILABLE: failed to open policy database at {}: {error}",
                db_path.display()
            )
        })?;

    let has_role = sqlx::query(
        "
        SELECT role
        FROM project_role_bindings
        WHERE workspace_id = ?
          AND project_id = ?
          AND actor_id = ?
          AND revoked_at_utc IS NULL
          AND role IN ('project_owner', 'ai_operator')
        LIMIT 1
        ",
    )
    .bind(workspace_id)
    .bind(project_id)
    .bind(actor_id)
    .fetch_optional(&pool)
    .await
    .map_err(|error| format!("POLICY_DB_QUERY_FAILED: role lookup failed: {error}"))?
    .is_some();

    if !has_role {
        return Err(
            "POLICY_ROLE_REQUIRED_FOR_EXTERNAL_AI: actor is not authorized for external AI usage."
                .to_string(),
        );
    }

    let has_override = if let Some(override_id) = override_id {
        sqlx::query(
            "
            SELECT id
            FROM policy_overrides
            WHERE id = ?
              AND workspace_id = ?
              AND project_id = ?
              AND actor_id = ?
              AND lower(provider_id) = ?
              AND sensitivity_level = ?
              AND revoked_at_utc IS NULL
              AND (
                expires_at_utc IS NULL
                OR expires_at_utc > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
              )
            LIMIT 1
            ",
        )
        .bind(override_id)
        .bind(workspace_id)
        .bind(project_id)
        .bind(actor_id)
        .bind(host)
        .bind(scope_sensitivity)
        .fetch_optional(&pool)
        .await
        .map_err(|error| format!("POLICY_DB_QUERY_FAILED: override lookup failed: {error}"))?
        .is_some()
    } else {
        sqlx::query(
            "
            SELECT id
            FROM policy_overrides
            WHERE workspace_id = ?
              AND project_id = ?
              AND actor_id = ?
              AND lower(provider_id) = ?
              AND sensitivity_level = ?
              AND revoked_at_utc IS NULL
              AND (
                expires_at_utc IS NULL
                OR expires_at_utc > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
              )
            LIMIT 1
            ",
        )
        .bind(workspace_id)
        .bind(project_id)
        .bind(actor_id)
        .bind(host)
        .bind(scope_sensitivity)
        .fetch_optional(&pool)
        .await
        .map_err(|error| format!("POLICY_DB_QUERY_FAILED: override lookup failed: {error}"))?
        .is_some()
    };

    if !has_override {
        return Err(
            "EXTERNAL_AI_DEFAULT_DENY: approved external AI override is required for this request."
                .to_string(),
        );
    }

    Ok(())
}

fn resolve_policy_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app_data_dir: {error}"))?;
    Ok(app_data_dir.join("korda_tools.db"))
}

fn normalize_sensitivity_level(value: &str) -> Result<&str, String> {
    let trimmed = value.trim();
    match trimmed {
        "Public" | "Internal" | "Confidential" | "Client-Confidential" => Ok(trimmed),
        _ => Err(
            "EXTERNAL_AI_CONTEXT_REQUIRED: sensitivity classification must be one of Public/Internal/Confidential/Client-Confidential."
                .to_string(),
        ),
    }
}

fn build_headers(raw_headers: &HashMap<String, String>) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    for (raw_name, raw_value) in raw_headers {
        let name = HeaderName::from_bytes(raw_name.trim().as_bytes())
            .map_err(|error| format!("invalid header name `{raw_name}`: {error}"))?;
        let value = HeaderValue::from_str(raw_value)
            .map_err(|error| format!("invalid header value for `{raw_name}`: {error}"))?;
        headers.insert(name, value);
    }
    Ok(headers)
}

fn clamp_timeout_ms(requested_timeout_ms: u64) -> u64 {
    if requested_timeout_ms == 0 {
        return DEFAULT_TIMEOUT_MS;
    }

    requested_timeout_ms.clamp(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)
}

fn is_allowed_external_ai_host(host: &str) -> bool {
    matches!(
        host,
        "api.openai.com" | "api.anthropic.com" | "openrouter.ai" | "localhost" | "127.0.0.1"
    ) || host.ends_with(".openai.azure.com")
}
