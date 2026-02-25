const SERVICE_NAME: &str = "korda-tools";

fn build_entry(credential_id: &str) -> Result<keyring::Entry, String> {
    if credential_id.trim().is_empty() {
        return Err("credential_id is required".to_string());
    }

    keyring::Entry::new(SERVICE_NAME, credential_id)
        .map_err(|error| format!("failed to build keyring entry: {error}"))
}

#[tauri::command]
pub async fn secret_set(credential_id: String, secret_value: String) -> Result<(), String> {
    let entry = build_entry(&credential_id)?;
    entry
        .set_password(&secret_value)
        .map_err(|error| format!("failed to store secret: {error}"))
}

#[tauri::command]
pub async fn secret_get(credential_id: String) -> Result<String, String> {
    let entry = build_entry(&credential_id)?;
    entry
        .get_password()
        .map_err(|error| format!("failed to read secret: {error}"))
}

#[tauri::command]
pub async fn secret_delete(credential_id: String) -> Result<(), String> {
    let entry = build_entry(&credential_id)?;
    entry
        .delete_credential()
        .map_err(|error| format!("failed to delete secret: {error}"))
}
