use crate::storage::local_db::LocalDb;
use crate::sync::cloud_sync::CloudSync;
use crate::tracker::{game_matcher, idle_detector, process_scanner};
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
    pub process_name: String,
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
    active_sessions: HashMap<String, ActiveSession>, // game_id -> session
    local_db: Arc<LocalDb>,
    paused: bool,
    today_completed_secs: i64,
}

impl SessionManager {
    pub fn new(local_db: Arc<LocalDb>) -> Self {
        Self {
            active_sessions: HashMap::new(),
            local_db,
            paused: false,
            today_completed_secs: 0,
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

    /// Main tick: scan processes, update sessions, detect idle.
    pub fn tick(&mut self) -> Vec<CompletedSession> {
        if self.paused {
            return vec![];
        }

        let running = process_scanner::scan_running_processes();
        let matched = game_matcher::match_games(&running, &self.local_db);
        let is_idle = idle_detector::is_idle();
        let now = Utc::now();

        let mut completed = Vec::new();

        // Start new sessions for newly detected games
        for game in &matched {
            if !self.active_sessions.contains_key(&game.game_id) {
                log::info!("Game detected: {} ({})", game.game_name, game.process_name);
                self.active_sessions.insert(
                    game.game_id.clone(),
                    ActiveSession {
                        session_id: None,
                        game_id: game.game_id.clone(),
                        game_name: game.game_name.clone(),
                        game_slug: game.game_slug.clone(),
                        process_name: game.process_name.clone(),
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

        // Update existing sessions
        let matched_ids: std::collections::HashSet<_> =
            matched.iter().map(|g| g.game_id.clone()).collect();

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
                log::info!(
                    "Game ended: {} ({}s)",
                    session.game_name,
                    duration
                );
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

        completed
    }
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

/// Background tracking loop. Runs every 30 seconds.
pub async fn tracking_loop(
    session_manager: Arc<Mutex<SessionManager>>,
    cloud_sync: Arc<Mutex<CloudSync>>,
    local_db: Arc<LocalDb>,
) {
    let mut tick_interval = interval(Duration::from_secs(30));
    let mut sync_counter: u32 = 0;

    loop {
        tick_interval.tick().await;

        // Run session tick
        let completed = {
            let mut manager = session_manager.lock().await;
            manager.tick()
        };

        // Handle completed sessions
        for session in &completed {
            // Store in local DB for offline queue
            if let Err(e) = local_db.queue_completed_session(session) {
                log::error!("Failed to queue session: {}", e);
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
}
