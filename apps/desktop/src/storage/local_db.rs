use anyhow::Result;
use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::Mutex;

use crate::tracker::session_manager::CompletedSession;

/// Cached game record synced from the cloud games table.
#[derive(Debug, Clone)]
pub struct CachedGame {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub cover_url: Option<String>,
}

/// Auth token storage reference (actual secrets in OS keychain).
#[derive(Debug, Clone)]
pub struct AuthTokenRef {
    pub has_access_token: bool,
    pub has_refresh_token: bool,
}

/// Local SQLite database for the agent.
pub struct LocalDb {
    conn: Mutex<Connection>,
}

impl LocalDb {
    pub fn new(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;

        // Migrate: drop old signatures table
        conn.execute_batch("DROP TABLE IF EXISTS signatures;")?;

        // Create tables
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS games_cache (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT NOT NULL,
                cover_url TEXT,
                synced_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS offline_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id TEXT NOT NULL,
                game_name TEXT NOT NULL DEFAULT '',
                started_at TEXT NOT NULL,
                ended_at TEXT NOT NULL,
                duration_secs INTEGER NOT NULL,
                active_secs INTEGER NOT NULL,
                idle_secs INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS auth_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                has_tokens INTEGER NOT NULL DEFAULT 0,
                last_refresh TEXT
            );

            CREATE TABLE IF NOT EXISTS custom_mappings (
                process_name TEXT PRIMARY KEY,
                game_id TEXT NOT NULL,
                game_name TEXT NOT NULL
            );
            ",
        )?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    // --- Games Cache ---

    pub fn replace_games_cache(&self, games: &[CachedGame]) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM games_cache", [])?;

        let mut stmt = conn.prepare(
            "INSERT INTO games_cache (id, name, slug, cover_url)
             VALUES (?1, ?2, ?3, ?4)",
        )?;

        for game in games {
            stmt.execute(params![game.id, game.name, game.slug, game.cover_url])?;
        }

        Ok(())
    }

    pub fn get_all_games(&self) -> Result<Vec<CachedGame>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT id, name, slug, cover_url FROM games_cache")?;

        let games = stmt
            .query_map([], |row| {
                Ok(CachedGame {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    slug: row.get(2)?,
                    cover_url: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(games)
    }

    /// Search games cache by name using case-insensitive LIKE matching.
    pub fn search_games_by_name(&self, query: &str) -> Result<Vec<CachedGame>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, slug, cover_url FROM games_cache
             WHERE LOWER(name) LIKE '%' || LOWER(?1) || '%'
             ORDER BY LENGTH(name) DESC",
        )?;

        let games = stmt
            .query_map(params![query], |row| {
                Ok(CachedGame {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    slug: row.get(2)?,
                    cover_url: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(games)
    }

    /// Add a single game to the cache (after IGDB resolution).
    pub fn add_game_to_cache(&self, game: &CachedGame) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO games_cache (id, name, slug, cover_url)
             VALUES (?1, ?2, ?3, ?4)",
            params![game.id, game.name, game.slug, game.cover_url],
        )?;
        Ok(())
    }

    pub fn get_game_count(&self) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let count: i64 =
            conn.query_row("SELECT COUNT(*) FROM games_cache", [], |row| row.get(0))?;
        Ok(count)
    }

    // --- Offline Queue ---

    pub fn queue_completed_session(&self, session: &CompletedSession) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO offline_queue (game_id, game_name, started_at, ended_at, duration_secs, active_secs, idle_secs)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                session.game_id,
                session.game_name,
                session.started_at.to_rfc3339(),
                session.ended_at.to_rfc3339(),
                session.duration_secs,
                session.active_secs,
                session.idle_secs,
            ],
        )?;
        Ok(())
    }

    pub fn get_pending_sessions(&self) -> Result<Vec<QueuedSession>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, game_id, game_name, started_at, ended_at, duration_secs, active_secs, idle_secs
             FROM offline_queue ORDER BY id ASC LIMIT 100",
        )?;

        let sessions = stmt
            .query_map([], |row| {
                Ok(QueuedSession {
                    id: row.get(0)?,
                    game_id: row.get(1)?,
                    game_name: row.get(2)?,
                    started_at: row.get(3)?,
                    ended_at: row.get(4)?,
                    duration_secs: row.get(5)?,
                    active_secs: row.get(6)?,
                    idle_secs: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(sessions)
    }

    pub fn remove_queued_sessions(&self, ids: &[i64]) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        for id in ids {
            conn.execute("DELETE FROM offline_queue WHERE id = ?1", params![id])?;
        }
        Ok(())
    }

    // --- Auth ---

    pub fn get_auth_tokens(&self) -> Result<Option<AuthTokenRef>> {
        let access = crate::auth::browser_auth::get_access_token();
        let refresh = crate::auth::browser_auth::get_refresh_token();

        if access.is_some() || refresh.is_some() {
            Ok(Some(AuthTokenRef {
                has_access_token: access.is_some(),
                has_refresh_token: refresh.is_some(),
            }))
        } else {
            Ok(None)
        }
    }

    pub fn clear_auth_tokens(&self) -> Result<()> {
        crate::auth::browser_auth::clear_keyring_tokens();
        Ok(())
    }

    // --- Custom Mappings ---

    pub fn add_custom_mapping(&self, process_name: &str, game_name: &str) -> Result<()> {
        let game_id = format!("custom::{}", process_name);
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO custom_mappings (process_name, game_id, game_name) VALUES (?1, ?2, ?3)",
            params![process_name, game_id, game_name],
        )?;
        Ok(())
    }

    pub fn remove_custom_mapping(&self, process_name: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM custom_mappings WHERE process_name = ?1",
            params![process_name],
        )?;
        Ok(())
    }

    pub fn get_all_custom_mappings(&self) -> Result<Vec<CustomMapping>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT process_name, game_id, game_name FROM custom_mappings")?;

        let mappings = stmt
            .query_map([], |row| {
                Ok(CustomMapping {
                    process_name: row.get(0)?,
                    game_id: row.get(1)?,
                    game_name: row.get(2)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(mappings)
    }

    // --- Settings ---

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        );

        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct CustomMapping {
    pub process_name: String,
    pub game_id: String,
    pub game_name: String,
}

#[derive(Debug, Clone)]
pub struct QueuedSession {
    pub id: i64,
    pub game_id: String,
    pub game_name: String,
    pub started_at: String,
    pub ended_at: String,
    pub duration_secs: i64,
    pub active_secs: i64,
    pub idle_secs: i64,
}
