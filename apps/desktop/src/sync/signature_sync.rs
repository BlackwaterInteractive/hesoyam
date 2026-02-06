// Signature sync has been replaced by games cache sync.
// The sync_games_cache method on CloudSync handles:
// 1. Fetching games from the Supabase games table via REST API
// 2. Replacing the local SQLite games cache
// 3. Called on startup and periodically
