use crate::storage::local_db::LocalDb;
use crate::sync::cloud_sync::{CloudSync, PresencePayload};
use crate::tracker::{game_matcher, idle_detector, process_scanner};
use crate::tracker::process_scanner::GameCandidate;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveSession {
    pub session_id: Option<String>, // Cloud session ID (None if not yet synced)
    pub game_id: String,
    pub game_name: String,
    pub game_slug: String,
    pub cover_url: Option<String>,
    pub window_title: String,
    pub started_at: DateTime<Utc>,
    pub last_update: DateTime<Utc>,
    pub total_duration_secs: i64,
    pub active_secs: i64,
    pub idle_secs: i64,
    pub is_idle: bool,
    pub is_custom: bool,
}

impl ActiveSession {
    pub fn duration_secs(&self) -> i64 {
        let elapsed = Utc::now().signed_duration_since(self.started_at);
        elapsed.num_seconds()
    }
}

pub struct SessionManager {
    pub(crate) active_sessions: HashMap<String, ActiveSession>, // game_id -> session
    local_db: Arc<LocalDb>,
    paused: bool,
    today_completed_secs: i64,
    /// Tracks window titles we've already tried to resolve via IGDB (avoid repeated lookups)
    resolution_attempted: std::collections::HashSet<String>,
}

impl SessionManager {
    pub fn new(local_db: Arc<LocalDb>) -> Self {
        Self {
            active_sessions: HashMap::new(),
            local_db,
            paused: false,
            today_completed_secs: 0,
            resolution_attempted: std::collections::HashSet::new(),
        }
    }

    pub fn get_active_sessions(&self) -> Vec<ActiveSession> {
        self.active_sessions.values().cloned().collect()
    }

    pub fn get_today_total_secs(&self) -> i64 {
        let active_secs: i64 = self
            .active_sessions
            .values()
            .map(|s| s.duration_secs())
            .sum();
        self.today_completed_secs + active_secs
    }

    pub fn set_paused(&mut self, paused: bool) {
        self.paused = paused;
        log::info!("Tracking paused: {}", paused);
    }

    pub fn is_paused(&self) -> bool {
        self.paused
    }

    /// Set the cloud session ID for an active session.
    pub fn set_session_id(&mut self, game_id: &str, session_id: String) {
        if let Some(session) = self.active_sessions.get_mut(game_id) {
            session.session_id = Some(session_id);
        }
    }

    /// Check if a window title has already been attempted for resolution.
    pub fn was_resolution_attempted(&self, window_title: &str) -> bool {
        self.resolution_attempted.contains(&window_title.to_lowercase())
    }

    /// Mark a window title as attempted for resolution.
    pub fn mark_resolution_attempted(&mut self, window_title: &str) {
        self.resolution_attempted.insert(window_title.to_lowercase());
    }

    /// Add a session for a game that was resolved via IGDB.
    pub fn add_resolved_session(
        &mut self,
        game_id: String,
        game_name: String,
        game_slug: String,
        cover_url: Option<String>,
        window_title: String,
    ) -> Option<String> {
        if self.active_sessions.contains_key(&game_id) {
            return None;
        }

        let now = Utc::now();
        self.active_sessions.insert(
            game_id.clone(),
            ActiveSession {
                session_id: None,
                game_id: game_id.clone(),
                game_name,
                game_slug,
                cover_url,
                window_title,
                started_at: now,
                last_update: now,
                total_duration_secs: 0,
                active_secs: 0,
                idle_secs: 0,
                is_idle: false,
                is_custom: false,
            },
        );

        Some(game_id)
    }

    /// Main tick: scan processes, update sessions, detect idle.
    /// Returns (completed_sessions, newly_started_game_ids, unresolved_candidates).
    pub fn tick(&mut self) -> TickResult {
        if self.paused {
            return TickResult::default();
        }

        let candidates = process_scanner::scan_game_candidates();
        let match_result = game_matcher::match_games(&candidates, &self.local_db);
        let is_idle = idle_detector::is_idle();
        let now = Utc::now();

        let mut completed = Vec::new();
        let mut started = Vec::new();

        // Start new sessions for matched games
        for game in &match_result.matched {
            if !self.active_sessions.contains_key(&game.game_id) {
                started.push(game.game_id.clone());
                log::info!("Game detected: {} (window: {})", game.game_name, game.window_title);
                self.active_sessions.insert(
                    game.game_id.clone(),
                    ActiveSession {
                        session_id: None,
                        game_id: game.game_id.clone(),
                        game_name: game.game_name.clone(),
                        game_slug: game.game_slug.clone(),
                        cover_url: game.cover_url.clone(),
                        window_title: game.window_title.clone(),
                        started_at: now,
                        last_update: now,
                        total_duration_secs: 0,
                        active_secs: 0,
                        idle_secs: 0,
                        is_idle: false,
                        is_custom: game.is_custom,
                    },
                );
            }
        }

        // Collect IDs of games still running (matched + currently active via window title)
        let matched_ids: std::collections::HashSet<_> =
            match_result.matched.iter().map(|g| g.game_id.clone()).collect();

        let ended_ids: Vec<String> = self
            .active_sessions
            .keys()
            .filter(|id| !matched_ids.contains(*id))
            .cloned()
            .collect();

        // End sessions for games no longer running
        for game_id in ended_ids {
            if let Some(session) = self.active_sessions.remove(&game_id) {
                let duration = session.duration_secs();
                log::info!("Game ended: {} ({}s)", session.game_name, duration);
                self.today_completed_secs += duration;
                completed.push(CompletedSession {
                    session_id: session.session_id,
                    game_id: session.game_id,
                    game_name: session.game_name,
                    started_at: session.started_at,
                    ended_at: now,
                    duration_secs: duration,
                    active_secs: session.active_secs,
                    idle_secs: session.idle_secs,
                    is_custom: session.is_custom,
                });
            }
        }

        // Update active sessions with idle state
        for session in self.active_sessions.values_mut() {
            let elapsed = now
                .signed_duration_since(session.last_update)
                .num_seconds();
            if is_idle {
                session.idle_secs += elapsed;
                session.is_idle = true;
            } else {
                session.active_secs += elapsed;
                session.is_idle = false;
            }
            session.total_duration_secs = session.active_secs + session.idle_secs;
            session.last_update = now;
        }

        // Filter unresolved to only those we haven't tried yet
        let unresolved: Vec<GameCandidate> = match_result
            .unresolved
            .into_iter()
            .filter(|c| !self.resolution_attempted.contains(&c.window_title.to_lowercase()))
            .collect();

        TickResult {
            completed,
            started,
            unresolved,
        }
    }
}

#[derive(Debug, Default)]
pub struct TickResult {
    pub completed: Vec<CompletedSession>,
    pub started: Vec<String>, // game_ids of newly started sessions
    pub unresolved: Vec<GameCandidate>, // candidates needing IGDB resolution
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletedSession {
    pub session_id: Option<String>,
    pub game_id: String,
    pub game_name: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: DateTime<Utc>,
    pub duration_secs: i64,
    pub active_secs: i64,
    pub idle_secs: i64,
    pub is_custom: bool,
}

/// Background tracking loop. Runs every 30 seconds with 5-second presence heartbeats.
pub async fn tracking_loop(
    session_manager: Arc<Mutex<SessionManager>>,
    cloud_sync: Arc<Mutex<CloudSync>>,
    local_db: Arc<LocalDb>,
) {
    let mut tick_interval = interval(Duration::from_secs(30));
    let mut presence_interval = interval(Duration::from_secs(5));
    let mut sync_counter: u32 = 0;

    loop {
        tokio::select! {
            _ = tick_interval.tick() => {
                // Run session tick
                let result = {
                    let mut manager = session_manager.lock().await;
                    manager.tick()
                };

                // Start cloud sessions for newly detected games
                if !result.started.is_empty() {
                    let sync = cloud_sync.lock().await;
                    let mut manager = session_manager.lock().await;
                    for game_id in &result.started {
                        // Skip custom games — they don't sync to cloud
                        if game_id.starts_with("custom::") {
                            continue;
                        }
                        let session_clone = manager.active_sessions.get(game_id).cloned();
                        if let Some(session) = session_clone {
                            let started_at = session.started_at.to_rfc3339();
                            match sync.start_session(game_id, &session.game_name, &started_at).await {
                                Ok(cloud_id) => {
                                    log::info!("Cloud session started for {}: {}", game_id, cloud_id);
                                    manager.set_session_id(game_id, cloud_id);
                                }
                                Err(e) => {
                                    log::warn!("Failed to start cloud session for {}: {}", game_id, e);
                                }
                            }

                            // Broadcast presence "start" event immediately
                            broadcast_session_presence(&sync, &session, "start").await;
                        }
                    }
                }

                // Resolve unmatched game candidates via IGDB
                if !result.unresolved.is_empty() {
                    let sync = cloud_sync.lock().await;
                    let mut manager = session_manager.lock().await;
                    for candidate in &result.unresolved {
                        manager.mark_resolution_attempted(&candidate.window_title);

                        log::info!("Resolving unmatched game via IGDB: {}", candidate.window_title);
                        match sync.resolve_game(&candidate.window_title).await {
                            Ok(Some(game)) => {
                                log::info!("Resolved: {} -> {} ({})", candidate.window_title, game.name, game.id);
                                // Add session for the resolved game
                                if let Some(game_id) = manager.add_resolved_session(
                                    game.id.clone(),
                                    game.name.clone(),
                                    game.slug.clone(),
                                    game.cover_url.clone(),
                                    candidate.window_title.clone(),
                                ) {
                                    // Start cloud session
                                    if let Some(session) = manager.active_sessions.get(&game_id).cloned() {
                                        let started_at = session.started_at.to_rfc3339();
                                        match sync.start_session(&game_id, &session.game_name, &started_at).await {
                                            Ok(cloud_id) => {
                                                manager.set_session_id(&game_id, cloud_id);
                                            }
                                            Err(e) => {
                                                log::warn!("Failed to start cloud session for resolved game: {}", e);
                                            }
                                        }
                                        broadcast_session_presence(&sync, &session, "start").await;
                                    }
                                }
                            }
                            Ok(None) => {
                                log::debug!("No IGDB match for: {}", candidate.window_title);
                            }
                            Err(e) => {
                                log::warn!("IGDB resolution failed for {}: {}", candidate.window_title, e);
                            }
                        }
                    }
                }

                // Handle completed sessions
                for session in &result.completed {
                    // Broadcast presence "end" event immediately
                    {
                        let sync = cloud_sync.lock().await;
                        broadcast_end_presence(&sync, session).await;
                    }

                    if let Some(ref cloud_id) = session.session_id {
                        // Session was live-synced — end it in cloud
                        let sync = cloud_sync.lock().await;
                        if let Err(e) = sync.end_session(
                            cloud_id,
                            &session.ended_at.to_rfc3339(),
                            session.duration_secs,
                            session.active_secs,
                            session.idle_secs,
                        ).await {
                            log::warn!("Failed to end cloud session: {}", e);
                            // Cloud end failed — queue for offline retry
                            if let Err(e) = local_db.queue_completed_session(session) {
                                log::error!("Failed to queue session: {}", e);
                            }
                        }
                    } else {
                        // No cloud session — queue for offline batch upload
                        if let Err(e) = local_db.queue_completed_session(session) {
                            log::error!("Failed to queue session: {}", e);
                        }
                    }
                }

                // Sync to cloud every 60 seconds (every 2 ticks)
                sync_counter += 1;
                if sync_counter % 2 == 0 {
                    let sync = cloud_sync.lock().await;

                    // Update active sessions in cloud
                    let manager = session_manager.lock().await;
                    for session in manager.get_active_sessions() {
                        if let Some(ref session_id) = session.session_id {
                            if let Err(e) = sync.update_session(session_id, &session).await {
                                log::warn!("Failed to update cloud session: {}", e);
                            }
                        }
                    }
                    drop(manager);

                    // Process offline queue
                    if let Err(e) = sync.process_offline_queue().await {
                        log::warn!("Failed to process offline queue: {}", e);
                    }
                }
            }
            _ = presence_interval.tick() => {
                // Broadcast presence heartbeat for all active sessions
                let sessions = {
                    let manager = session_manager.lock().await;
                    manager.get_active_sessions()
                };

                if !sessions.is_empty() {
                    let sync = cloud_sync.lock().await;
                    for session in &sessions {
                        // Skip custom games — they don't have cloud presence
                        if session.is_custom {
                            continue;
                        }
                        broadcast_session_presence(&sync, session, "heartbeat").await;
                    }
                }
            }
        }
    }
}

/// Broadcast presence for an active session.
async fn broadcast_session_presence(sync: &CloudSync, session: &ActiveSession, event: &str) {
    if let Some(user_id) = crate::auth::browser_auth::get_user_id() {
        let payload = PresencePayload {
            user_id,
            game_id: session.game_id.clone(),
            game_name: session.game_name.clone(),
            game_slug: session.game_slug.clone(),
            cover_url: session.cover_url.clone(),
            started_at: session.started_at.to_rfc3339(),
            event: event.to_string(),
        };
        if let Err(e) = sync.broadcast_presence(payload).await {
            log::warn!("Failed to broadcast presence: {}", e);
        }
    }
}

/// Broadcast presence end event for a completed session.
async fn broadcast_end_presence(sync: &CloudSync, session: &CompletedSession) {
    // Skip custom games
    if session.is_custom {
        return;
    }

    if let Some(user_id) = crate::auth::browser_auth::get_user_id() {
        let payload = PresencePayload {
            user_id,
            game_id: session.game_id.clone(),
            game_name: session.game_name.clone(),
            game_slug: String::new(),
            cover_url: None,
            started_at: session.started_at.to_rfc3339(),
            event: "end".to_string(),
        };
        if let Err(e) = sync.broadcast_presence(payload).await {
            log::warn!("Failed to broadcast presence end: {}", e);
        }
    }
}
