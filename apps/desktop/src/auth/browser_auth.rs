use anyhow::Result;
use tiny_http::{Response, Server};
use url::Url;

const CALLBACK_PORT: u16 = 19284;
const WEB_APP_URL: &str = "https://hesoyam.gg";

/// Auth tokens received from the browser callback.
#[derive(Debug, Clone)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
}

/// Starts the browser-based auth flow:
/// 1. Starts a temporary localhost HTTP server
/// 2. Opens the browser to the web app's agent-auth page
/// 3. Waits for the callback with tokens
/// 4. Stores tokens in OS keyring
pub async fn start_auth_flow() -> Result<String> {
    let callback_url = format!("http://localhost:{}/callback", CALLBACK_PORT);
    let auth_url = format!(
        "{}/agent-auth?redirect={}",
        WEB_APP_URL,
        urlencoding::encode(&callback_url)
    );

    // Start temporary HTTP server
    let server = Server::http(format!("127.0.0.1:{}", CALLBACK_PORT))
        .map_err(|e| anyhow::anyhow!("Failed to start callback server: {}", e))?;

    // Open browser
    log::info!("Opening browser for auth: {}", auth_url);
    open::that(&auth_url)?;

    // Wait for callback (with 5 minute timeout)
    let tokens = tokio::task::spawn_blocking(move || -> Result<AuthTokens> {
        // Set a timeout by accepting with a deadline
        for request in server.incoming_requests() {
            let url_str = format!("http://localhost{}", request.url());
            if let Ok(url) = Url::parse(&url_str) {
                if url.path() == "/callback" {
                    let params: std::collections::HashMap<_, _> =
                        url.query_pairs().into_owned().collect();

                    let access_token = params
                        .get("access_token")
                        .cloned()
                        .unwrap_or_default();
                    let refresh_token = params
                        .get("refresh_token")
                        .cloned()
                        .unwrap_or_default();

                    if !access_token.is_empty() {
                        // Send success response
                        let html = r#"<!DOCTYPE html>
<html>
<head><title>Hesoyam</title></head>
<body style="background:#09090b;color:white;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
<h1 style="color:#10b981">Connected!</h1>
<p style="color:#a1a1aa">You can close this window and return to Hesoyam.</p>
</div>
</body>
</html>"#;
                        let response = Response::from_string(html)
                            .with_header(
                                tiny_http::Header::from_bytes(
                                    &b"Content-Type"[..],
                                    &b"text/html"[..],
                                )
                                .unwrap(),
                            );
                        let _ = request.respond(response);

                        // Store in keyring
                        store_tokens(&access_token, &refresh_token);

                        return Ok(AuthTokens {
                            access_token,
                            refresh_token,
                        });
                    }
                }
            }

            // Send redirect for non-callback requests
            let _ = request.respond(
                Response::from_string("Redirecting...")
                    .with_status_code(302)
                    .with_header(
                        tiny_http::Header::from_bytes(&b"Location"[..], auth_url.as_bytes())
                            .unwrap(),
                    ),
            );
        }

        Err(anyhow::anyhow!("Auth server closed without receiving tokens"))
    })
    .await??;

    Ok(tokens.access_token)
}

/// Store auth tokens in the OS keyring.
fn store_tokens(access_token: &str, refresh_token: &str) {
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

/// Clear all stored tokens from keyring.
pub fn clear_keyring_tokens() {
    if let Ok(entry) = keyring::Entry::new("hesoyam", "access_token") {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = keyring::Entry::new("hesoyam", "refresh_token") {
        let _ = entry.delete_credential();
    }
}

mod urlencoding {
    pub fn encode(input: &str) -> String {
        let mut result = String::new();
        for byte in input.bytes() {
            match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    result.push(byte as char);
                }
                _ => {
                    result.push_str(&format!("%{:02X}", byte));
                }
            }
        }
        result
    }
}
