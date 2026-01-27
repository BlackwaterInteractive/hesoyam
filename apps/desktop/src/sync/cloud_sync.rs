use crate::auth::browser_auth;
use crate::storage::local_db::{LocalDb, LocalSignature};
use crate::tracker::session_manager::ActiveSession;
use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

const SUPABASE_URL: &str = "https://oubdkgdzssmckayxfrjs.supabase.co";
const SUPABASE_ANON_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91YmRrZ2R6c3NtY2theXhmcmpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDM5MjcsImV4cCI6MjA4NDk3OTkyN30.wphj9diIsIdy_vJmX9_DzOxtA8CeaXRbvFe-sRKSCF0";

pub struct CloudSync {
    client: Client,
    local_db: Arc<LocalDb>,
}

#[derive(Serialize)]
struct SessionInsert {
    user_id: String,
    game_id: String,
    started_at: String,
    ended_at: Option<String>,
    duration_secs: i64,
    active_secs: i64,
    idle_secs: i64,
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

#[derive(Deserialize)]
struct SignaturesResponse {
    signatures: Vec<SignatureEntry>,
}

#[derive(Deserialize)]
struct SignatureEntry {
    process_name: String,
    game_id: String,
    game_name: Option<String>,
    game_slug: Option<String>,
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

    /// Start a new session in the cloud. Returns the session ID.
    pub async fn start_session(
        &self,
        game_id: &str,
        started_at: &str,
    ) -> Result<String> {
        let auth = self
            .get_auth_header()
            .ok_or_else(|| anyhow::anyhow!("Not authenticated"))?;

        let user_id = self
            .get_user_id()
            .ok_or_else(|| anyhow::anyhow!("No user ID available"))?;

        let body = SessionInsert {
            user_id,
            game_id: game_id.to_string(),
            started_at: started_at.to_string(),
            ended_at: None,
            duration_secs: 0,
            active_secs: 0,
            idle_secs: 0,
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
        let auth = self
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
        let auth = self
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

        let auth = match self.get_auth_header() {
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
                    started_at: s.started_at.clone(),
                    ended_at: Some(s.ended_at.clone()),
                    duration_secs: s.duration_secs,
                    active_secs: s.active_secs,
                    idle_secs: s.idle_secs,
                });
            }
        }

        // Remove custom sessions from queue without uploading
        if !custom_ids.is_empty() {
            self.local_db.remove_queued_sessions(&custom_ids)?;
            log::info!("Removed {} custom sessions from offline queue (local only)", custom_ids.len());
        }

        if cloud_sessions.is_empty() {
            return Ok(());
        }

        let batch = BatchUpload { sessions: cloud_sessions };

        let resp = self
            .client
            .post(format!(
                "{}/functions/v1/session-batch",
                SUPABASE_URL
            ))
            .header("Authorization", &auth)
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Content-Type", "application/json")
            .json(&batch)
            .send()
            .await?;

        if resp.status().is_success() {
            let ids: Vec<i64> = pending.iter().filter(|s| !s.game_id.starts_with("custom::")).map(|s| s.id).collect();
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

    /// Sync game signatures from the cloud to local DB.
    /// Does not require authentication — signatures are public data.
    pub async fn sync_signatures(&self) -> Result<()> {
        let resp = self
            .client
            .get(format!(
                "{}/functions/v1/game-signatures",
                SUPABASE_URL
            ))
            .header("apikey", SUPABASE_ANON_KEY)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to fetch signatures: {} - {}",
                status,
                text
            ));
        }

        let data: SignaturesResponse = resp.json().await?;
        let signatures: Vec<LocalSignature> = data
            .signatures
            .into_iter()
            .map(|s| LocalSignature {
                process_name: s.process_name,
                game_id: s.game_id,
                game_name: s.game_name.unwrap_or_default(),
                game_slug: s.game_slug.unwrap_or_default(),
                cover_url: s.cover_url,
            })
            .collect();

        let count = signatures.len();
        self.local_db.replace_signatures(&signatures)?;
        log::info!("Synced {} game signatures from cloud", count);

        Ok(())
    }
}
