use crate::storage::local_db::LocalDb;
use crate::tracker::process_scanner::GameCandidate;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct MatchedGame {
    pub game_id: String,
    pub game_name: String,
    pub game_slug: String,
    pub cover_url: Option<String>,
    pub window_title: String,
    pub is_custom: bool,
}

pub struct MatchResult {
    pub matched: Vec<MatchedGame>,
    pub unresolved: Vec<GameCandidate>,
}

/// Matches game candidates against the local games cache and custom mappings.
///
/// For each candidate:
/// 1. Check custom mappings first (by exe name) — user overrides always win
/// 2. Check if any cached game name appears in the window title (case-insensitive)
/// 3. If no match, add to unresolved list for IGDB resolution
pub fn match_games(candidates: &[GameCandidate], local_db: &Arc<LocalDb>) -> MatchResult {
    let games = match local_db.get_all_games() {
        Ok(g) => g,
        Err(e) => {
            log::error!("Failed to load games cache: {}", e);
            return MatchResult {
                matched: vec![],
                unresolved: candidates.to_vec(),
            };
        }
    };

    let custom_mappings = match local_db.get_all_custom_mappings() {
        Ok(m) => m,
        Err(e) => {
            log::error!("Failed to load custom mappings: {}", e);
            vec![]
        }
    };

    let mut matched = Vec::new();
    let mut unresolved = Vec::new();
    let mut seen_game_ids = std::collections::HashSet::new();

    for candidate in candidates {
        // 1. Check custom mappings by exe name
        let custom_match = custom_mappings
            .iter()
            .find(|m| m.process_name.eq_ignore_ascii_case(&candidate.exe_name));

        if let Some(mapping) = custom_match {
            if seen_game_ids.insert(mapping.game_id.clone()) {
                matched.push(MatchedGame {
                    game_id: mapping.game_id.clone(),
                    game_name: mapping.game_name.clone(),
                    game_slug: String::new(),
                    cover_url: None,
                    window_title: candidate.window_title.clone(),
                    is_custom: true,
                });
            }
            continue;
        }

        // 2. Match window title against games cache
        // Find the best match: longest game name that appears in the window title
        let title_lower = candidate.window_title.to_lowercase();

        let best_match = games
            .iter()
            .filter(|g| title_lower.contains(&g.name.to_lowercase()))
            .max_by_key(|g| g.name.len());

        if let Some(game) = best_match {
            if seen_game_ids.insert(game.id.clone()) {
                matched.push(MatchedGame {
                    game_id: game.id.clone(),
                    game_name: game.name.clone(),
                    game_slug: game.slug.clone(),
                    cover_url: game.cover_url.clone(),
                    window_title: candidate.window_title.clone(),
                    is_custom: false,
                });
            }
        } else {
            // 3. No match found — needs IGDB resolution
            unresolved.push(candidate.clone());
        }
    }

    MatchResult {
        matched,
        unresolved,
    }
}
