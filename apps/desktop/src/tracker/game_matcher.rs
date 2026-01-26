use crate::storage::local_db::LocalDb;
use std::collections::HashSet;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct MatchedGame {
    pub game_id: String,
    pub game_name: String,
    pub game_slug: String,
    pub process_name: String,
}

/// Matches running process names against the local signature database.
pub fn match_games(
    running_processes: &HashSet<String>,
    local_db: &Arc<LocalDb>,
) -> Vec<MatchedGame> {
    let signatures = match local_db.get_all_signatures() {
        Ok(sigs) => sigs,
        Err(e) => {
            log::error!("Failed to load signatures from local DB: {}", e);
            return vec![];
        }
    };

    let mut matched = Vec::new();
    let mut seen_game_ids = HashSet::new();

    for sig in &signatures {
        // Check if this process is running (case-insensitive match)
        let is_running = running_processes
            .iter()
            .any(|p| p.eq_ignore_ascii_case(&sig.process_name));

        if is_running && !seen_game_ids.contains(&sig.game_id) {
            seen_game_ids.insert(sig.game_id.clone());
            matched.push(MatchedGame {
                game_id: sig.game_id.clone(),
                game_name: sig.game_name.clone(),
                game_slug: sig.game_slug.clone(),
                process_name: sig.process_name.clone(),
            });
        }
    }

    matched
}
