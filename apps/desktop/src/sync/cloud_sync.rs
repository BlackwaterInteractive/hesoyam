use crate::auth::browser_auth;
use crate::storage::local_db::{CachedGame, LocalDb};
use crate::tracker::session_manager::ActiveSession;
use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

const SUPABASE_URL: &str = "https://oubdkgdzssmckayxfrjs.supabase.co";
const SUPABASE_ANON_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91YmRrZ2R6c3NtY2theXhmcmpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDM5MjcsImV4cCI6MjA4NDk3OTkyN30.wphj9diIsIdy_vJmX9_DzOxtA8CeaXRbvFe-sRKSCF0";

#[derive(Debug, Clone, Serialize)]
pub struct PresencePayload {
    pub user_id: String,
    pub game_id: String,
    pub game_name: String,
    pub game_slug: String,
    pub cover_url: Option<String>,
    pub started_at: String,
    pub event: String, // "start" | "heartbeat" | "end"
}

#[derive(Serialize)]
struct BroadcastMessage {
    topic: String,
    event: String,
    payload: PresencePayload,
}

#[derive(Serialize)]
struct BroadcastRequest {
    messages: Vec<BroadcastMessage>,
}

pub struct CloudSync {
    client: Client,
    local_db: Arc<LocalDb>,
}

#[derive(Serialize)]
struct SessionInsert {
    user_id: String,
    game_id: String,
    game_name: String,
    started_at: String,
    ended_at: Option<String>,
    duration_secs: i64,
    active_secs: i64,
    idle_secs: i64,
    source: String,
}

#[derive(Serialize)]
struct SessionUpdate {
    duration_secs: i64,
    active_secs: i64,
    idle_secs: i64,
    ended_at: Option<String>,
}

#[derive(Serialize)]
struct BatchUpload {
    sessions: Vec<SessionInsert>,
}

#[derive(Deserialize)]
struct BatchResponse {
    inserted: Option<i64>,
}

// --- Games cache sync types ---

#[derive(Deserialize)]
struct GameEntry {
    id: String,
    name: String,
    slug: Option<String>,
    cover_url: Option<String>,
}

// --- IGDB resolution types ---

#[derive(Serialize)]
struct IgdbSearchRequest {
    query: String,
    limit: u32,
}

#[derive(Deserialize)]
struct IgdbSearchResponse {
    results: Option<Vec<IgdbSearchResult>>,
}

#[derive(Deserialize)]
struct IgdbSearchResult {
    igdb_id: i64,
    name: String,
}

#[derive(Serialize)]
struct IgdbImportRequest {
    igdb_id: i64,
}

#[derive(Deserialize)]
struct IgdbImportResponse {
    game: Option<IgdbImportedGame>,
}

#[derive(Deserialize)]
struct IgdbImportedGame {
    id: String,
    name: String,
    slug: String,
    cover_url: Option<String>,
}

impl CloudSync {
    pub fn new(local_db: Arc<LocalDb>) -> Self {
        Self {
            client: Client::new(),
            local_db,
        }
    }

    fn get_auth_header(&self) -> Option<String> {
        browser_auth::get_access_token().map(|t| format!("Bearer {}", t))
    }

    fn get_user_id(&self) -> Option<String> {
        browser_auth::get_user_id()
    }

    /// Refresh the access token and return the new auth header.
    async fn refresh_and_get_auth(&self) -> Option<String> {
        match browser_auth::refresh_access_token().await {
            Ok(token) => Some(format!("Bearer {}", token)),
            Err(e) => {
                log::warn!("Failed to refresh token: {}", e);
                None
            }
        }
    }

    /// Start a new session in the cloud. Returns the session ID.
    pub async fn start_session(
        &self,
        game_id: &str,
        game_name: &str,
        started_at: &str,
    ) -> Result<String> {
        let mut auth = self
            .get_auth_header()
            .ok_or_else(|| anyhow::anyhow!("Not authenticated"))?;

        let user_id = self
            .get_user_id()
            .ok_or_else(|| anyhow::anyhow!("No user ID available"))?;

        let body = SessionInsert {
            user_id,
            game_id: game_id.to_string(),
            game_name: game_name.to_string(),
            started_at: started_at.to_string(),
            ended_at: None,
            duration_secs: 0,
            active_secs: 0,
            idle_secs: 0,
            source: "agent".to_string(),
        };

        let resp = self
            .client
            .post(format!("{}/rest/v1/game_sessions", SUPABASE_URL))
            .header("Authorization", &auth)
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Content-Type", "application/json")
            .header("Prefer", "return=representation")
            .json(&[&body])
            .send()
            .await?;

        // Handle 401 - refresh token and retry
        let resp = if resp.status().as_u16() == 401 {
            log::info!("start_session got 401, attempting token refresh...");
            auth = self
                .refresh_and_get_auth()
                .await
                .ok_or_else(|| anyhow::anyhow!("Token refresh failed"))?;

            self.client
                .post(format!("{}/rest/v1/game_sessions", SUPABASE_URL))
                .header("Authorization", &auth)
                .header("apikey", SUPABASE_ANON_KEY)
                .header("Content-Type", "application/json")
                .header("Prefer", "return=representation")
                .json(&[&body])
                .send()
                .await?
        } else {
            resp
        };

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to start session: {} - {}",
                status,
                text
            ));
        }

        let data: Vec<serde_json::Value> = resp.json().await?;
        let session_id = data
            .first()
            .and_then(|v| v.get("id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("No session ID returned"))?
            .to_string();

        Ok(session_id)
    }

    /// Update an active session in the cloud.
    pub async fn update_session(
        &self,
        session_id: &str,
        session: &ActiveSession,
    ) -> Result<()> {
        let mut auth = self
            .get_auth_header()
            .ok_or_else(|| anyhow::anyhow!("Not authenticated"))?;

        let body = SessionUpdate {
            duration_secs: session.total_duration_secs,
            active_secs: session.active_secs,
            idle_secs: session.idle_secs,
            ended_at: None,
        };

        let resp = self
            .client
            .patch(format!(
                "{}/rest/v1/game_sessions?id=eq.{}",
                SUPABASE_URL, session_id
            ))
            .header("Authorization", &auth)
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        // Handle 401 - refresh token and retry
        let resp = if resp.status().as_u16() == 401 {
            log::info!("update_session got 401, attempting token refresh...");
            auth = self
                .refresh_and_get_auth()
                .await
                .ok_or_else(|| anyhow::anyhow!("Token refresh failed"))?;

            self.client
                .patch(format!(
                    "{}/rest/v1/game_sessions?id=eq.{}",
                    SUPABASE_URL, session_id
                ))
                .header("Authorization", &auth)
                .header("apikey", SUPABASE_ANON_KEY)
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await?
        } else {
            resp
        };

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to update session: {} - {}",
                status,
                text
            ));
        }

        Ok(())
    }

    /// End a session in the cloud.
    pub async fn end_session(
        &self,
        session_id: &str,
        ended_at: &str,
        duration_secs: i64,
        active_secs: i64,
        idle_secs: i64,
    ) -> Result<()> {
        let mut auth = self
            .get_auth_header()
            .ok_or_else(|| anyhow::anyhow!("Not authenticated"))?;

        let body = SessionUpdate {
            duration_secs,
            active_secs,
            idle_secs,
            ended_at: Some(ended_at.to_string()),
        };

        let resp = self
            .client
            .patch(format!(
                "{}/rest/v1/game_sessions?id=eq.{}",
                SUPABASE_URL, session_id
            ))
            .header("Authorization", &auth)
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        // Handle 401 - refresh token and retry
        let resp = if resp.status().as_u16() == 401 {
            log::info!("end_session got 401, attempting token refresh...");
            auth = self
                .refresh_and_get_auth()
                .await
                .ok_or_else(|| anyhow::anyhow!("Token refresh failed"))?;

            self.client
                .patch(format!(
                    "{}/rest/v1/game_sessions?id=eq.{}",
                    SUPABASE_URL, session_id
                ))
                .header("Authorization", &auth)
                .header("apikey", SUPABASE_ANON_KEY)
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await?
        } else {
            resp
        };

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to end session: {} - {}",
                status,
                text
            ));
        }

        Ok(())
    }

    /// Process the offline queue - upload pending sessions in batch.
    pub async fn process_offline_queue(&self) -> Result<()> {
        let pending = self.local_db.get_pending_sessions()?;
        if pending.is_empty() {
            return Ok(());
        }

        let mut auth = match self.get_auth_header() {
            Some(a) => a,
            None => return Ok(()), // Not authenticated, skip
        };

        let user_id = match self.get_user_id() {
            Some(id) => id,
            None => return Ok(()), // No user ID, skip
        };

        // Separate custom sessions (local-only) from cloud-uploadable sessions
        let mut custom_ids = Vec::new();
        let mut cloud_sessions = Vec::new();

        for s in &pending {
            if s.game_id.starts_with("custom::") {
                custom_ids.push(s.id);
            } else {
                cloud_sessions.push(SessionInsert {
                    user_id: user_id.clone(),
                    game_id: s.game_id.clone(),
                    game_name: s.game_name.clone(),
                    started_at: s.started_at.clone(),
                    ended_at: Some(s.ended_at.clone()),
                    duration_secs: s.duration_secs,
                    active_secs: s.active_secs,
                    idle_secs: s.idle_secs,
                    source: "agent".to_string(),
                });
            }
        }

        // Remove custom sessions from queue without uploading
        if !custom_ids.is_empty() {
            self.local_db.remove_queued_sessions(&custom_ids)?;
            log::info!(
                "Removed {} custom sessions from offline queue (local only)",
                custom_ids.len()
            );
        }

        if cloud_sessions.is_empty() {
            return Ok(());
        }

        let batch = BatchUpload {
            sessions: cloud_sessions,
        };

        let resp = self
            .client
            .post(format!("{}/functions/v1/session-batch", SUPABASE_URL))
            .header("Authorization", &auth)
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Content-Type", "application/json")
            .json(&batch)
            .send()
            .await?;

        // Handle 401 - refresh token and retry
        let resp = if resp.status().as_u16() == 401 {
            log::info!("process_offline_queue got 401, attempting token refresh...");
            if let Some(new_auth) = self.refresh_and_get_auth().await {
                auth = new_auth;
                self.client
                    .post(format!("{}/functions/v1/session-batch", SUPABASE_URL))
                    .header("Authorization", &auth)
                    .header("apikey", SUPABASE_ANON_KEY)
                    .header("Content-Type", "application/json")
                    .json(&batch)
                    .send()
                    .await?
            } else {
                return Ok(()); // Token refresh failed, skip for now
            }
        } else {
            resp
        };

        if resp.status().is_success() {
            let ids: Vec<i64> = pending
                .iter()
                .filter(|s| !s.game_id.starts_with("custom::"))
                .map(|s| s.id)
                .collect();
            self.local_db.remove_queued_sessions(&ids)?;
            log::info!("Uploaded {} sessions from offline queue", ids.len());
        } else {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            log::warn!(
                "Failed to upload offline queue: {} - {}",
                status,
                text
            );
        }

        Ok(())
    }

    /// Sync games catalog from the cloud to local DB.
    /// Fetches from the games REST API (public data).
    pub async fn sync_games_cache(&self) -> Result<()> {
        let resp = self
            .client
            .get(format!(
                "{}/rest/v1/games?select=id,name,slug,cover_url&limit=5000",
                SUPABASE_URL
            ))
            .header("apikey", SUPABASE_ANON_KEY)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to fetch games: {} - {}",
                status,
                text
            ));
        }

        let entries: Vec<GameEntry> = resp.json().await?;
        let games: Vec<CachedGame> = entries
            .into_iter()
            .map(|e| CachedGame {
                id: e.id,
                name: e.name,
                slug: e.slug.unwrap_or_default(),
                cover_url: e.cover_url,
            })
            .collect();

        let count = games.len();
        self.local_db.replace_games_cache(&games)?;
        log::info!("Synced {} games from cloud", count);

        Ok(())
    }

    /// Resolve an unknown game via IGDB edge functions.
    /// Searches IGDB, imports the best match, and caches locally.
    pub async fn resolve_game(&self, window_title: &str) -> Result<Option<CachedGame>> {
        let auth = match self.get_auth_header() {
            Some(a) => a,
            None => return Ok(None),
        };

        // 1. Search IGDB
        let search_resp = self
            .client
            .post(format!("{}/functions/v1/igdb-search", SUPABASE_URL))
            .header("Authorization", &auth)
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Content-Type", "application/json")
            .json(&IgdbSearchRequest {
                query: window_title.to_string(),
                limit: 3,
            })
            .send()
            .await?;

        if !search_resp.status().is_success() {
            log::warn!(
                "IGDB search failed: {}",
                search_resp.status()
            );
            return Ok(None);
        }

        let search_data: IgdbSearchResponse = search_resp.json().await?;
        let results = match search_data.results {
            Some(r) if !r.is_empty() => r,
            _ => return Ok(None),
        };

        // Find best match: prefer exact name match, otherwise take first result
        let title_lower = window_title.to_lowercase();
        let best = results
            .iter()
            .find(|r| r.name.to_lowercase() == title_lower)
            .unwrap_or(&results[0]);

        // 2. Import from IGDB
        let import_resp = self
            .client
            .post(format!("{}/functions/v1/igdb-import-game", SUPABASE_URL))
            .header("Authorization", &auth)
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Content-Type", "application/json")
            .json(&IgdbImportRequest {
                igdb_id: best.igdb_id,
            })
            .send()
            .await?;

        if !import_resp.status().is_success() {
            log::warn!(
                "IGDB import failed: {}",
                import_resp.status()
            );
            return Ok(None);
        }

        let import_data: IgdbImportResponse = import_resp.json().await?;
        let game = match import_data.game {
            Some(g) => g,
            None => return Ok(None),
        };

        let cached = CachedGame {
            id: game.id,
            name: game.name,
            slug: game.slug,
            cover_url: game.cover_url,
        };

        // Cache locally for future lookups
        if let Err(e) = self.local_db.add_game_to_cache(&cached) {
            log::warn!("Failed to cache resolved game: {}", e);
        }

        Ok(Some(cached))
    }

    /// Broadcast real-time presence to Supabase Broadcast channel.
    pub async fn broadcast_presence(&self, payload: PresencePayload) -> Result<()> {
        let mut auth = match self.get_auth_header() {
            Some(a) => a,
            None => return Ok(()), // Not authenticated, skip silently
        };

        let request = BroadcastRequest {
            messages: vec![BroadcastMessage {
                topic: format!("realtime:presence:{}", payload.user_id),
                event: "game_presence".to_string(),
                payload,
            }],
        };

        let resp = self
            .client
            .post(format!("{}/realtime/v1/api/broadcast", SUPABASE_URL))
            .header("Authorization", &auth)
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        // Handle 401 - try to refresh token and retry once
        if resp.status().as_u16() == 401 {
            log::info!("Broadcast got 401, attempting token refresh...");
            if let Some(new_auth) = self.refresh_and_get_auth().await {
                auth = new_auth;
                let retry_resp = self
                    .client
                    .post(format!("{}/realtime/v1/api/broadcast", SUPABASE_URL))
                    .header("Authorization", &auth)
                    .header("apikey", SUPABASE_ANON_KEY)
                    .header("Content-Type", "application/json")
                    .json(&request)
                    .send()
                    .await?;

                if !retry_resp.status().is_success() {
                    let status = retry_resp.status();
                    let text = retry_resp.text().await.unwrap_or_default();
                    log::warn!(
                        "Failed to broadcast presence after refresh: {} - {}",
                        status,
                        text
                    );
                }
                return Ok(());
            }
        } else if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            log::warn!("Failed to broadcast presence: {} - {}", status, text);
        }

        Ok(())
    }
}
