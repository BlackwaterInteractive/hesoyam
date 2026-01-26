// Signature sync functionality is implemented in cloud_sync.rs
// This module re-exports for convenience.

// The sync_signatures method on CloudSync handles:
// 1. Fetching signatures from the game-signatures Edge Function
// 2. Replacing the local SQLite signature cache
// 3. Called on startup and periodically (daily)
