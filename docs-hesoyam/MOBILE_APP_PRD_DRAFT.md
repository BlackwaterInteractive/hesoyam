# Hesoyam Mobile App — PRD Draft

**Status:** DRAFT — Parked until Games API is implemented
**Last Updated:** 2026-02-06
**Author:** ijuice

---

## Vision

Hesoyam mobile is a **gaming social network** — not just a dashboard port. The core loop: follow friends, see what they're playing live, discover games through real playtime data, and share your gaming identity through reviews backed by verified hours.

**Key differentiator:** Reviews show verified playtime. When someone rates a game 9/10, you can see they actually put 200 hours into it.

---

## Core Screens & Features

### 1. Home Feed (Timeline)
- Live activity cards: "ijuice is playing Elden Ring right now (2h 14m in)"
- Session recaps: "alex finished a 4h session of Hades II"
- Social actions: "sara added Silksong to her wishlist", "mike reviewed Balatro (9/10, 85h played)"
- Tap any card → game page or profile

### 2. Search & Discovery
- Search users by username
- Search games by name
- "People you may know" (mutual followers, same Discord server)
- Trending games (most played across the platform this week)
- Curated collections: "Best Roguelikes of 2026", "Under 10 Hours", "Cozy Games"

### 3. Profile
- Avatar, bio, stats (total hours, games played, top genre)
- Currently playing (live indicator)
- Game shelf: **Playing / Played / Wishlist / Dropped**
- Reviews tab
- Followers / Following counts
- Follow / Unfollow button
- Privacy: public, followers-only, private

### 4. Game Page
- Cover art, metadata (genre, developer, year)
- Community rating (average from all users)
- Your status: Playing / Played / Wishlist / Dropped (one-tap toggle)
- Your review (if any)
- Community reviews (sorted by: friends first, then popular)
- Stats: "342 Hesoyam users played this, avg 48h"
- Friends who play this game (avatars row)
- "Want to play" count (social proof)

### 5. Reviews
- Rating: 1-10 scale (or 1-5 stars — TBD)
- Short text review (optional, max ~500 chars)
- Auto-attached: total playtime + sessions count (verified badge)
- Spoiler tag toggle
- Like/heart reviews
- Require actual playtime to review? (TBD)

### 6. Wishlist
- Add any game from search or game page
- Reorder by priority (drag)
- See which friends also want this game
- Optional: "notify me when a friend starts playing this"
- Import from Steam wishlist?

### 7. Notifications (Push)
- "ijuice started playing Elden Ring" (configurable per-user)
- "sara reviewed a game you played"
- "mike started following you"
- "3 friends added Silksong to their wishlist this week"
- Weekly digest: "Your friends played 142h this week. Here's what's trending."

### 8. Now Playing Page
- Dedicated view: all followed users currently in a game
- Like "friends online" from Steam/Discord but richer
- Shows game, duration, cover art
- Tap to react/cheer

---

## What Makes This Different from Must

| Must (Movies) | Hesoyam (Games) |
|---|---|
| Self-reported "watched" | **Verified playtime** from agent/Discord |
| Reviews are opinions only | Reviews show actual hours played |
| Static activity | **Live "now playing"** — real-time social |
| Collections curated by editors | Collections + auto-generated ("Most played by your friends") |
| No time dimension | Time is the core metric |

---

## New Database Tables Needed

- **`follows`** — follower_id, following_id, created_at
- **`game_reviews`** — user_id, game_id, rating, text, spoiler, playtime_at_review, created_at, updated_at
- **`wishlists`** — user_id, game_id, priority, added_at
- **`game_statuses`** — user_id, game_id, status (playing/played/wishlist/dropped), updated_at
- **`notifications`** — user_id, type, data (jsonb), read, created_at
- **`review_likes`** — user_id, review_id, created_at
- **`collections`** — id, title, description, cover_url, curator_id, type (curated/auto)
- **`collection_games`** — collection_id, game_id, position

---

## Open Decisions

| Question | Options |
|----------|---------|
| Rating scale | 1-5 stars vs 1-10 |
| Review without playing? | No (purity) vs Yes with "no playtime" badge |
| Game shelf categories | Playing / Played / Wishlist / Dropped — add "Backlog"? |
| Feed algorithm | Chronological vs ranked (friends > strangers, live > past) |
| Tech stack | React Native / Expo vs Flutter vs native Swift+Kotlin |
| Auth | Same Supabase auth + add Google/Apple sign-in |
| Mobile game tracking? | No (consumption only) vs Yes (Android background detection) |

---

## MVP Phases

### Phase 1 — Social Core
- Follow/unfollow, search users
- Home feed (live sessions + completed sessions of followed users)
- Profile page (own + others)
- Push notifications (follow, live session)

### Phase 2 — Game Identity
- Game pages with community stats
- Game shelf (Playing / Played / Wishlist / Dropped)
- Wishlist management

### Phase 3 — Reviews & Discovery
- Write/read reviews with verified playtime
- Rating system
- Curated collections
- Trending games
- Search games

---

## Blocker

**Games API (IGDB integration) must be implemented first.** The mobile app depends heavily on rich game metadata — covers, genres, descriptions, developer info — for game pages, search, discovery, and collections. Without a populated games database, the social features have nothing to wrap around.
