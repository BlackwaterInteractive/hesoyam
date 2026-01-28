use crate::storage::local_db::LocalDb;
use std::collections::HashSet;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct MatchedGame {
    pub game_id: String,
    pub game_name: String,
    pub game_slug: String,
    pub cover_url: Option<String>,
    pub process_name: String,
    pub is_custom: bool,
}

/// Matches running process names against the local signature database,
/// then against custom mappings for any unmatched processes.
/// Approved signatures always take priority over custom mappings.
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
    let mut matched_processes = HashSet::new();

    // First pass: match against approved signatures (priority)
    for sig in &signatures {
        let is_running = running_processes
            .iter()
            .any(|p| p.eq_ignore_ascii_case(&sig.process_name));

        if is_running && !seen_game_ids.contains(&sig.game_id) {
            seen_game_ids.insert(sig.game_id.clone());
            matched_processes.insert(sig.process_name.to_lowercase());
            matched.push(MatchedGame {
                game_id: sig.game_id.clone(),
                game_name: sig.game_name.clone(),
                game_slug: sig.game_slug.clone(),
                cover_url: sig.cover_url.clone(),
                process_name: sig.process_name.clone(),
                is_custom: false,
            });
        }
    }

    // Second pass: match against custom mappings for unmatched processes
    let custom_mappings = match local_db.get_all_custom_mappings() {
        Ok(mappings) => mappings,
        Err(e) => {
            log::error!("Failed to load custom mappings: {}", e);
            return matched;
        }
    };

    for mapping in &custom_mappings {
        // Skip if already matched by an approved signature
        if matched_processes.contains(&mapping.process_name.to_lowercase()) {
            continue;
        }

        let is_running = running_processes
            .iter()
            .any(|p| p.eq_ignore_ascii_case(&mapping.process_name));

        if is_running && !seen_game_ids.contains(&mapping.game_id) {
            seen_game_ids.insert(mapping.game_id.clone());
            matched.push(MatchedGame {
                game_id: mapping.game_id.clone(),
                game_name: mapping.game_name.clone(),
                game_slug: String::new(),
                cover_url: None,
                process_name: mapping.process_name.clone(),
                is_custom: true,
            });
        }
    }

    matched
}
