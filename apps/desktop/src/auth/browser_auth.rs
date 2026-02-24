use anyhow::Result;

const WEB_APP_URL: &str = "https://hesoyam.gg";
const SUPABASE_URL: &str = "https://oubdkgdzssmckayxfrjs.supabase.co";
const SUPABASE_ANON_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91YmRrZ2R6c3NtY2theXhmcmpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDM5MjcsImV4cCI6MjA4NDk3OTkyN30.wphj9diIsIdy_vJmX9_DzOxtA8CeaXRbvFe-sRKSCF0";

/// Auth tokens received from Supabase.
#[derive(Debug, Clone)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
}

/// Sign in with email and password via Supabase REST API.
pub async fn sign_in_with_password(email: &str, password: &str) -> Result<AuthTokens> {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!(
            "{}/auth/v1/token?grant_type=password",
            SUPABASE_URL
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "email": email,
            "password": password,
        }))
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body: serde_json::Value = resp.json().await.unwrap_or_default();
        let msg = body
            .get("error_description")
            .or_else(|| body.get("msg"))
            .or_else(|| body.get("message"))
            .and_then(|v| v.as_str())
            .unwrap_or("Sign in failed");

        return Err(anyhow::anyhow!("{}", match status.as_u16() {
            400 => format!("Invalid email or password: {}", msg),
            422 => format!("Invalid input: {}", msg),
            429 => "Too many attempts. Please try again later.".to_string(),
            _ => format!("Sign in failed ({}): {}", status, msg),
        }));
    }

    let data: serde_json::Value = resp.json().await?;
    let access_token = data
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("No access token in response"))?
        .to_string();
    let refresh_token = data
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("No refresh token in response"))?
        .to_string();
    let user_id = data
        .get("user")
        .and_then(|u| u.get("id"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("No user ID in response"))?
        .to_string();

    store_tokens(&access_token, &refresh_token, &user_id);

    Ok(AuthTokens {
        access_token,
        refresh_token,
    })
}

/// Open the signup page in the default browser.
pub fn open_signup() {
    let url = format!("{}/signup", WEB_APP_URL);
    if let Err(e) = open::that(&url) {
        log::error!("Failed to open signup URL: {}", e);
    }
}

/// Store auth tokens in the OS keyring.
fn store_tokens(access_token: &str, refresh_token: &str, user_id: &str) {
    if let Ok(entry) = keyring::Entry::new("hesoyam", "access_token") {
        if let Err(e) = entry.set_password(access_token) {
            log::error!("Failed to store access token in keyring: {}", e);
        }
    }
    if let Ok(entry) = keyring::Entry::new("hesoyam", "refresh_token") {
        if let Err(e) = entry.set_password(refresh_token) {
            log::error!("Failed to store refresh token in keyring: {}", e);
        }
    }
    if let Ok(entry) = keyring::Entry::new("hesoyam", "user_id") {
        if let Err(e) = entry.set_password(user_id) {
            log::error!("Failed to store user ID in keyring: {}", e);
        }
    }
}

/// Retrieve access token from the OS keyring.
pub fn get_access_token() -> Option<String> {
    keyring::Entry::new("hesoyam", "access_token")
        .ok()
        .and_then(|entry| entry.get_password().ok())
}

/// Retrieve refresh token from the OS keyring.
pub fn get_refresh_token() -> Option<String> {
    keyring::Entry::new("hesoyam", "refresh_token")
        .ok()
        .and_then(|entry| entry.get_password().ok())
}

/// Retrieve user ID from the OS keyring.
pub fn get_user_id() -> Option<String> {
    keyring::Entry::new("hesoyam", "user_id")
        .ok()
        .and_then(|entry| entry.get_password().ok())
}

/// Clear all stored tokens from keyring.
pub fn clear_keyring_tokens() {
    if let Ok(entry) = keyring::Entry::new("hesoyam", "access_token") {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = keyring::Entry::new("hesoyam", "refresh_token") {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = keyring::Entry::new("hesoyam", "user_id") {
        let _ = entry.delete_credential();
    }
}

/// Refresh the access token using the stored refresh token.
/// Returns the new access token on success.
pub async fn refresh_access_token() -> Result<String> {
    let refresh_token = get_refresh_token()
        .ok_or_else(|| anyhow::anyhow!("No refresh token available"))?;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!(
            "{}/auth/v1/token?grant_type=refresh_token",
            SUPABASE_URL
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "refresh_token": refresh_token,
        }))
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body: serde_json::Value = resp.json().await.unwrap_or_default();
        let msg = body
            .get("error_description")
            .or_else(|| body.get("msg"))
            .or_else(|| body.get("message"))
            .and_then(|v| v.as_str())
            .unwrap_or("Token refresh failed");

        // If refresh fails with 401/403, tokens are invalid - clear them
        if status.as_u16() == 401 || status.as_u16() == 403 {
            log::warn!("Refresh token invalid, clearing stored tokens");
            clear_keyring_tokens();
        }

        return Err(anyhow::anyhow!("Token refresh failed ({}): {}", status, msg));
    }

    let data: serde_json::Value = resp.json().await?;
    let access_token = data
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("No access token in refresh response"))?
        .to_string();
    let new_refresh_token = data
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("No refresh token in refresh response"))?
        .to_string();
    let user_id = get_user_id()
        .ok_or_else(|| anyhow::anyhow!("No user ID available"))?;

    // Store the new tokens
    store_tokens(&access_token, &new_refresh_token, &user_id);
    log::info!("Access token refreshed successfully");

    Ok(access_token)
}
