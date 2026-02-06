# Hesoyam - Gaming Journal & Wrapped Platform

## Product Requirements Document (MVP)

**Version:** 0.2.0
**Last Updated:** 2026-02-04
**Author:** ijuice

---

## 1. Vision

Hesoyam is a personal gaming journal that automatically tracks what you play, how long you play, and turns that data into shareable year-end (and monthly) "Wrapped" experiences. Think Spotify Wrapped, but for your gaming life.

**Tagline:** _Your gaming year, wrapped._

**MVP Scope:** Windows tracking agent + Discord RP tracking + Web dashboard

---

## 2. Problem Statement

Gamers have no unified way to:
- Track play time across all their PC games (not just Steam)
- Reflect on their gaming habits over time (journal-style)
- Share their gaming identity and stats as social content
- Get personalized insights about their gaming patterns

Steam tracks hours but only for Steam games. Discord Rich Presence is real-time only with no history. There's no "gaming journal" that captures the full picture and turns it into something shareable.

---

## 3. Target Users

### Primary: PC Gamers (ages 16-30)
- Play games across multiple launchers (Steam, Epic, Xbox, standalone)
- Active on social media (Twitter/X, Discord, Instagram)
- Care about stats, achievements, and their gaming identity
- Already familiar with Spotify Wrapped and similar experiences

### Secondary: Content Creators & Streamers
- Want to share gaming stats with their audience
- Value profile pages that showcase their gaming personality

---

## 4. MVP Features

### 4.1 Windows Tracking Agent

A lightweight background process that detects and logs gaming sessions.

#### Core Functionality

| Feature | Description | Priority |
|---------|-------------|----------|
| **Game Detection** | Detect running games via game directory check + window title matching against pre-seeded IGDB database | P0 |
| **Session Tracking** | Log session start, end, and duration with idle detection | P0 |
| **System Tray App** | Minimal UI — tray icon with status, pause/resume, current session info | P0 |
| **Auto-Start** | Option to launch on Windows startup | P1 |
| **Manual Game Add** | User can manually tag any window as a tracked game, or add to ignore list | P1 |
| **Cloud Sync** | Push session data to Hesoyam API in real-time | P0 |
| **Offline Support** | Queue sessions locally when offline, sync when back online | P1 |
| **Low Resource Usage** | < 50MB RAM, < 1% CPU at all times | P0 |

#### Game Detection Strategy

The agent uses **window title matching** against a pre-seeded game database (populated via IGDB bulk import before launch). Process names are NOT used for game identification — they are unreliable and require manual mapping.

```
1. Scan running processes every 30 seconds
2. Filter: is this process running from a known game directory?
   - Steam:  C:\Program Files\Steam\steamapps\common\*
   - Epic:   C:\Program Files\Epic Games\*
   - GOG:    C:\Program Files\GOG Galaxy\Games\*
   - Xbox:   C:\XboxGames\*
   - If NO → ignore (not a game)
   - If YES → proceed to identification
3. Read the window title of the detected process
4. Fuzzy match window title against games table (pre-seeded with
   2000+ games from IGDB, with full metadata)
   - If match found → start tracking immediately
   - If no match → search IGDB via edge function → import game
5. User can manually tag any window as a game ("track this")
6. User can add processes/windows to an ignore list
```

#### Session Logic

```
Session Start:
  - Game process detected running
  - Create session record with timestamp

Session Active:
  - Track focus state (game window is foreground)
  - Detect idle: no keyboard/mouse input for 5+ minutes
    while game is running -> mark as "idle"
  - Idle time is tracked separately (not counted in active play time)

Session End:
  - Game process no longer running
  - OR system shutdown/sleep detected
  - Finalize session with end timestamp
  - Calculate: total_duration, active_duration, idle_duration
```

#### System Tray UI

```
Tray Icon States:
  - Green dot: Currently tracking a game
  - Grey dot: Running, no game detected
  - Paused icon: Tracking paused by user

Right-click Menu:
  - "Currently playing: [Game Name] (1h 23m)" (if active)
  - "Today: 3h 45m played"
  - ---
  - Pause / Resume Tracking
  - Open Dashboard (opens web browser)
  - Settings
  - ---
  - Quit Hesoyam

Settings Window (minimal):
  - Auto-start on boot: [toggle]
  - Show notifications for session summaries: [toggle]
  - Tracked games list (add/remove/rename)
  - Account: signed in as [email] | Sign out
```

#### Notifications

- **Session end summary:** "You played Elden Ring for 2h 14m" (dismissable toast)
- **Daily summary (optional):** "You played 4h 32m today across 3 games"
- **Weekly milestone:** "You've played 20 hours this week — your most active week this month"

---

### 4.2 Discord Rich Presence Tracking

An alternative zero-install tracking method that monitors Discord Rich Presence to track gaming sessions.

#### Overview

Users who prefer not to install the desktop agent can connect their Discord account to track games via Discord's Rich Presence. This also enables tracking of console games (PlayStation, Xbox) when connected to Discord.

#### How It Works

1. User joins the Hesoyam Discord server (required for the bot to see their presence)
2. User connects their Discord User ID in the dashboard settings
3. Hesoyam bot monitors their Discord Rich Presence
4. When Discord detects a game, a session is created automatically
5. When the game ends, the session is closed

#### Core Functionality

| Feature | Description | Priority |
|---------|-------------|----------|
| **Presence Monitoring** | Detect games via Discord's `presenceUpdate` events | P0 |
| **Session Creation** | Create sessions when "Playing" activity is detected | P0 |
| **Real-time Sync** | Push presence updates via Supabase Broadcast | P0 |
| **Agent Priority** | If desktop agent is running, defer to it | P0 |
| **Console Support** | Track PS/Xbox games connected to Discord | P1 |

#### Limitations vs Desktop Agent

| Feature | Desktop Agent | Discord RP |
|---------|---------------|------------|
| Offline gaming | ✅ Yes | ❌ No |
| Console games | ❌ No | ✅ Yes |
| Idle detection | ✅ Yes | ❌ No |
| Pause/Resume | ✅ Yes | ❌ No |
| Custom game tracking | ✅ Yes | ❌ No |
| No install required | ❌ No | ✅ Yes |

#### Priority Rules

- **One active session per user** — enforced at database level
- **Agent has priority** — if agent is running (heartbeat within 60s), Discord tracking is skipped
- **Agent takes over** — if agent starts while Discord session is active, agent takes ownership

#### User Requirements

1. Must join the Hesoyam Discord server
2. Must have "Display current activity as a status message" enabled in Discord settings
3. Must enter their Discord User ID in dashboard settings (immutable once set)

See [DISCORD_RP_TRACKING.md](./DISCORD_RP_TRACKING.md) for full technical documentation.

---

### 4.3 Web Dashboard

The primary interface for viewing stats, managing your profile, and generating Wrapped content.

#### 4.3.1 Authentication

| Feature | Description | Priority |
|---------|-------------|----------|
| **Email + Password** | Primary sign-in via Supabase Auth (email/password with email verification) | P0 |
| **Magic Link** | Passwordless sign-in option via Supabase Auth | P1 |

#### 4.3.2 Dashboard Home

The main view after login. Shows an overview of your gaming activity.

```
+----------------------------------------------------------+
|  HESOYAM                    [Search]  [Profile] [Settings]|
+----------------------------------------------------------+
|                                                          |
|  Welcome back, ijuice                                    |
|                                                          |
|  TODAY           THIS WEEK        THIS MONTH             |
|  2h 34m          14h 12m          52h 08m                |
|  2 games         5 games          8 games                |
|                                                          |
|  +-- Currently Playing ----------------------------+     |
|  |  Elden Ring        Started 45m ago              |     |
|  +-------------------------------------------------+     |
|                                                          |
|  +-- Recent Sessions ------------------------------+     |
|  |  Today                                          |     |
|  |  [img] Elden Ring         1h 23m    2:00 PM     |     |
|  |  [img] Hades II           0h 45m   11:30 AM     |     |
|  |                                                 |     |
|  |  Yesterday                                      |     |
|  |  [img] Elden Ring         3h 12m    8:00 PM     |     |
|  |  [img] Valorant           1h 05m    6:30 PM     |     |
|  +-------------------------------------------------+     |
|                                                          |
|  +-- This Week's Breakdown ------------------------+     |
|  |  [Bar chart: hours per day, colored by game]    |     |
|  +-------------------------------------------------+     |
|                                                          |
+----------------------------------------------------------+
```

#### 4.3.3 Game Library

All games the user has ever played, tracked by Hesoyam.

```
+----------------------------------------------------------+
|  MY GAMES (23)                    Sort: [Most Played v]  |
+----------------------------------------------------------+
|                                                          |
|  +-- Game Card -----------+  +-- Game Card -----------+  |
|  | [Cover Art]            |  | [Cover Art]            |  |
|  | Elden Ring             |  | Valorant               |  |
|  | 342h total             |  | 128h total             |  |
|  | Last played: Today     |  | Last played: Yesterday |  |
|  | Sessions: 89           |  | Sessions: 204          |  |
|  +------------------------+  +------------------------+  |
|                                                          |
|  Sort options: Most Played | Recently Played | A-Z       |
|  Filter: All | This Month | This Year                    |
+----------------------------------------------------------+
```

**Game Detail Page:**
```
+----------------------------------------------------------+
|  <- Back to Library                                      |
|                                                          |
|  [Large Cover Art]                                       |
|  ELDEN RING                                              |
|  Action RPG | FromSoftware | 2022                        |
|                                                          |
|  TOTAL TIME        SESSIONS      AVG SESSION    STREAK   |
|  342h 18m          89            3h 51m         5 days   |
|                                                          |
|  First played: March 12, 2026                            |
|  Last played: Today                                      |
|                                                          |
|  +-- Play Time Over Time -------------------------+      |
|  |  [Line/area chart: hours per week over months]  |      |
|  +-------------------------------------------------+     |
|                                                          |
|  +-- Session History ------------------------------+     |
|  |  Jan 26 - 1h 23m (2:00 PM - 3:23 PM)          |     |
|  |  Jan 25 - 3h 12m (8:00 PM - 11:12 PM)         |     |
|  |  Jan 24 - 2h 45m (7:15 PM - 10:00 PM)         |     |
|  |  ...                                            |     |
|  +-------------------------------------------------+     |
+----------------------------------------------------------+
```

#### 4.3.4 Stats & Insights

Dedicated analytics page with deeper breakdowns.

```
+----------------------------------------------------------+
|  STATS                     Period: [This Month v]        |
+----------------------------------------------------------+
|                                                          |
|  +-- Time Breakdown ------------------------------+      |
|  |  [Donut chart: hours by game, top 5 + "other"] |      |
|  +-------------------------------------------------+     |
|                                                          |
|  +-- Genre Distribution ---------------------------+     |
|  |  [Horizontal bar chart: hours by genre]         |     |
|  |  RPG           ████████████████  45%            |     |
|  |  FPS           ████████          22%            |     |
|  |  Roguelike     ██████            16%            |     |
|  |  Strategy      ████              11%            |     |
|  |  Other         ██                 6%            |     |
|  +-------------------------------------------------+     |
|                                                          |
|  +-- Play Patterns --------------------------------+     |
|  |  [Heatmap: day of week x hour of day]           |     |
|  |  "You play most on Saturday evenings"           |     |
|  +-------------------------------------------------+     |
|                                                          |
|  +-- Streaks & Milestones -------------------------+     |
|  |  Current streak: 5 days                         |     |
|  |  Longest streak: 23 days (Dec 2025)             |     |
|  |  Total games played: 23                         |     |
|  |  Total hours: 1,247                             |     |
|  |  Most played day: Saturday (avg 4.2h)           |     |
|  +-------------------------------------------------+     |
|                                                          |
+----------------------------------------------------------+
```

#### 4.3.5 Calendar / Journal View

A day-by-day view of gaming activity — the "journal" aspect.

```
+----------------------------------------------------------+
|  JOURNAL                                    January 2026 |
+----------------------------------------------------------+
|  Mon   Tue   Wed   Thu   Fri   Sat   Sun                 |
|  ---   ---   ---   ---   ---   ---   ---                 |
|              1     2     3     4     5                    |
|              1.2h  --    0.5h  3.1h  4.5h                |
|                                                          |
|  6     7     8     9     10    11    12                   |
|  --    2.3h  1.1h  --    1.8h  5.2h  3.7h               |
|  ...                                                     |
+----------------------------------------------------------+
|                                                          |
|  Selected: January 11, 2026 (Saturday)                   |
|  Total: 5h 12m                                           |
|                                                          |
|  [img] Elden Ring       3h 30m    4:00 PM - 7:30 PM     |
|  [img] Hades II         1h 42m    8:15 PM - 9:57 PM     |
+----------------------------------------------------------+
```

Cells are color-coded by intensity (more hours = deeper color). Clicking a day shows the sessions for that day.

#### 4.3.6 Profile Page (Public)

A shareable public profile that showcases your gaming identity.

```
URL: hesoyam.gg/u/ijuice

+----------------------------------------------------------+
|  [Avatar]                                                |
|  ijuice                                                  |
|  "souls enjoyer"                                         |
|  Member since Jan 2026                                   |
|                                                          |
|  TOTAL HOURS     GAMES PLAYED    TOP GENRE               |
|  1,247           23              RPG                     |
|                                                          |
|  +-- Top Games --------------------------------+         |
|  |  1. Elden Ring        342h                  |         |
|  |  2. Valorant          128h                  |         |
|  |  3. Hades II           96h                  |         |
|  |  4. Civilization VI    87h                   |         |
|  |  5. Celeste            52h                  |         |
|  +---------------------------------------------+         |
|                                                          |
|  +-- Currently Playing ----------------------------+     |
|  |  Elden Ring - 45m into session                  |     |
|  +--------------------------------------------------+   |
|                                                          |
|  +-- Recent Activity ------------------------------+     |
|  |  [Activity feed of recent sessions]             |     |
|  +-------------------------------------------------+     |
+----------------------------------------------------------+
```

### 4.4 Settings & Account

| Feature | Description | Priority |
|---------|-------------|----------|
| **Profile editing** | Display name, bio, avatar upload | P0 |
| **Privacy controls** | Profile visibility: public / friends-only / private | P1 |
| **Discord connection** | Connect Discord User ID for RP tracking (immutable once set) | P0 |
| **Tracking status** | Show which tracking method is active (agent/discord/both) | P0 |
| **Connected accounts** | Steam (for importing historical data) | P1 |
| **Steam import** | One-time import of play time from Steam API | P1 |
| **Notification prefs** | Toggle session summaries, weekly recaps, milestones | P1 |
| **Data export** | Download all your data as JSON/CSV | P2 |
| **Delete account** | Full data deletion | P1 |

---

## 5. Technical Architecture (High Level)

```
+------------------+                      +----------------------+
|  Windows Agent   |                      |  Discord RP Server   |
|  (Rust / Tauri)  |                      |  (Node.js)           |
+--------+---------+                      +----------+-----------+
         |                                           |
         |  REST API                    Discord Gateway API
         |                                           |
         |    +--------------------------------------+
         |    |
         v    v
+--------+----+--------+
|       Supabase       |
|  +----------------+  |
|  | Auth           |  |
|  | PostgreSQL     |  |
|  | Edge Functions |  |
|  | Realtime       |  |
|  | Storage        |  |
|  +----------------+  |
+-----------+----------+
            |
            | Realtime (Broadcast)
            |
+-----------v----------+
|    Web Dashboard     |
|    (Next.js)         |
+----------------------+
```

### Tracking Flow

```
User plays a game
        |
        +---------------------------+
        |                           |
        v                           v
  Desktop Agent              Discord detects game
  (process scan)             (Rich Presence)
        |                           |
        v                           v
  Agent running?  <----- Discord RP Server checks
        |                    agent_last_seen
   YES  |  NO                      |
        |   \                      |
        v    \                     v
  Agent creates          Discord RP creates
  session (priority)     session (fallback)
        |                           |
        +-------------+-------------+
                      |
                      v
              game_sessions table
              (one active per user)
                      |
                      v
              Supabase Broadcast
                      |
                      v
              Web Dashboard
              (real-time updates)
```

### Tech Stack (Proposed)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Windows Agent** | Rust + Tauri | Low resource usage, native system tray, cross-compile potential for future Mac support |
| **Discord RP Server** | Node.js + discord.js | Real-time Discord Gateway integration for presence monitoring |
| **Backend** | Supabase (PostgreSQL + Edge Functions) | Auth, DB, storage, and serverless functions in one platform. Less infra to manage for MVP |
| **Database** | Supabase PostgreSQL | Relational data with Row Level Security (RLS), real-time subscriptions |
| **Real-time** | Supabase Realtime (Broadcast) | Presence updates pushed to web dashboard |
| **Web Dashboard** | Next.js (App Router) | SSR for public profiles, React for dashboard |
| **Auth** | Supabase Auth (email/password + magic link) | Built-in auth with email verification, session management, and RLS |
| **Game Metadata** | IGDB API | Cover art, genres, release dates, platform info |
| **Hosting** | Vercel (web) + Supabase (backend) + VPS (Discord bot) | Simple deployment, generous free tiers |
| **File Storage** | Supabase Storage | Wrapped images, avatars — integrated with auth & RLS |

### Key Data Models

```
User (extends Supabase auth.users)
  id                  UUID (FK -> auth.users.id)
  email               String (unique, from Supabase Auth)
  username            String (unique, hesoyam handle)
  display_name        String
  avatar_url          String
  bio                 String
  privacy             Enum (public, friends_only, private)
  discord_id          String (unique, nullable, immutable once set)
  discord_connected_at DateTime (nullable)
  agent_last_seen     DateTime (nullable, updated every 30s when agent running)
  created_at          DateTime
  updated_at          DateTime

Game
  id              UUID
  igdb_id         Int (nullable, linked to IGDB)
  name            String
  slug            String
  cover_url       String
  genres          String[] (from IGDB)
  developer       String
  release_year    Int
  created_at      DateTime

GameSession
  id              UUID
  user_id         UUID (FK -> User)
  game_id         UUID (FK -> Game, nullable for Discord sessions)
  game_name       String (nullable, set for Discord sessions)
  started_at      DateTime
  ended_at        DateTime (nullable if live)
  duration_secs   Int (total)
  active_secs     Int (excluding idle)
  idle_secs       Int
  source          Enum (agent, discord) - which system created/owns this session
  created_at      DateTime

  @@index([user_id, started_at])
  @@index([user_id, game_id])
  @@unique([user_id] WHERE ended_at IS NULL) - one active session per user

  Note: Discord sessions have game_id=NULL and game_name set.
        Agent sessions have game_id set and game_name=NULL.
        UserGame stats only update for agent sessions (game_id required).

UserGame (aggregated stats, updated on session end)
  user_id         UUID (FK -> User)
  game_id         UUID (FK -> Game)
  total_time_secs Int
  total_sessions  Int
  first_played    DateTime
  last_played     DateTime
  avg_session_secs Int

  @@id([user_id, game_id])

```

---

## 6. API Endpoints (Draft)

### Auth (Supabase handles auth endpoints directly)
```
POST   /auth/v1/signup                -> Sign up with email/password (Supabase)
POST   /auth/v1/token?grant_type=password -> Sign in (Supabase)
POST   /auth/v1/magiclink            -> Send magic link email (Supabase)
POST   /auth/v1/logout               -> Sign out (Supabase)
GET    /api/auth/me                   -> Get current user profile (custom)
```

### Sessions (Agent -> API)
```
POST   /api/sessions                  -> Create/start a new session
PATCH  /api/sessions/:id              -> Update session (end, idle time)
POST   /api/sessions/batch            -> Batch upload (offline sync)
```

### Dashboard
```
GET    /api/dashboard/overview        -> Today/week/month summary
GET    /api/dashboard/activity        -> Recent sessions feed
GET    /api/dashboard/calendar        -> Calendar heatmap data
```

### Games
```
GET    /api/games                     -> User's game library
GET    /api/games/:id                 -> Game detail with user stats
GET    /api/games/:id/sessions        -> Sessions for a specific game
```

### Stats
```
GET    /api/stats/time                -> Time breakdown (by period)
GET    /api/stats/genres              -> Genre distribution
GET    /api/stats/patterns            -> Play pattern heatmap
GET    /api/stats/streaks             -> Streak data
```

### Profile
```
GET    /api/profile/:username         -> Public profile data
PATCH  /api/profile                   -> Update profile
```

### Games API (IGDB)
```
POST   /functions/v1/igdb-search      -> Search IGDB for games by name
POST   /functions/v1/igdb-import-game -> Import a game from IGDB into our DB
```

---

## 7. User Flows

### 7.1 Onboarding

```
1. User visits hesoyam.gg
2. Sees landing page with value prop + screenshots
3. Clicks "Sign Up" -> enters email + password (or magic link)
4. Verifies email via Supabase confirmation link
5. Picks a username -> redirected to dashboard (empty state)
6. User chooses tracking method:

   OPTION A: Desktop Agent
   ├── Download the Hesoyam tracker for Windows
   ├── Install and sign in (opens browser, same email auth)
   └── Agent starts tracking automatically

   OPTION B: Discord Rich Presence
   ├── Join the Hesoyam Discord server
   ├── Go to Settings → Connect Discord
   ├── Enter Discord User ID (immutable once set)
   └── Bot starts monitoring presence automatically

7. First session appears on dashboard in real-time
```

### 7.2 Daily Usage

```
1. User boots PC -> Hesoyam agent starts automatically
2. User launches a game
3. Agent detects game via directory check + window title match, starts session
4. Tray icon turns green: "Playing Elden Ring"
5. User plays for 2 hours
6. User closes game
7. Agent ends session, shows toast: "You played Elden Ring for 2h 03m"
8. Session synced to cloud instantly
9. User can check dashboard anytime for stats
```

---

## 8. MVP Milestones

### Milestone 1: Foundation
- [ ] Project setup (monorepo, CI/CD)
- [ ] Database schema + migrations
- [ ] Auth system (Supabase email auth)
- [ ] Basic API endpoints (sessions, games)
- [ ] Seed games database with top 2000+ games via IGDB bulk import

### Milestone 2: Windows Agent
- [ ] Process detection engine (game directory check + window title reading)
- [ ] Game matching via window title against pre-seeded games DB
- [ ] Session tracking with idle detection
- [ ] System tray UI
- [ ] Cloud sync (real-time + offline queue)
- [ ] Auto-start on boot
- [ ] Installer / auto-updater
- [ ] Agent heartbeat (agent_last_seen) for priority detection
- [ ] Take over Discord sessions when agent starts
- [ ] IGDB fallback search for unrecognized games
- [ ] User ignore list for non-game processes

### Milestone 2.5: Discord RP Server
- [x] Discord bot setup with Presence Intent
- [x] Presence monitoring for connected users
- [x] Session creation/closing based on presence changes
- [x] Agent priority check (skip if agent active)
- [x] Supabase Realtime broadcast for presence updates
- [x] User cache with Realtime subscription for new connections

### Milestone 3: Web Dashboard
- [x] Dashboard home (overview + recent sessions)
- [x] Game library page
- [x] Game detail page
- [x] Calendar / journal view
- [x] Stats & insights page
- [x] Profile page (public)
- [x] Settings page
- [x] Discord connection UI (enter User ID, display status)
- [x] Tracking method selection/display

### Milestone 4: Polish & Launch
- [ ] Landing page
- [ ] Onboarding flow
- [ ] Steam import (historical play time)
- [ ] Performance optimization
- [ ] Beta testing with 50-100 users
- [ ] Public launch

---

## 9. Success Metrics

| Metric | Target (3 months post-launch) |
|--------|-------------------------------|
| Registered users | 1,000 |
| Daily active trackers | 300 (30% DAU/MAU) |
| Avg sessions tracked per user/week | 5+ |
| Dashboard weekly active users | 40% of registered users |
| Agent retention (still running after 7 days) | 50% |

---

## 10. Out of Scope (MVP)

These are intentionally excluded from MVP to keep scope tight:

- Wrapped experience (year-end, monthly recaps, share cards) — v2
- Mac agent (future)
- Mobile app
- Social features (friends, following, feed)
- Achievements / badges / gamification
- Game recommendations
- Direct integration with console platforms (PlayStation, Xbox, Nintendo) — however, console games CAN be tracked via Discord RP if user has Discord connected to their console
- Multiplayer session detection (who you played with)
- In-game stats (KDA, rank, etc.) — just time tracking for now
- Monetization features (premium plans, payments)
- Community features (forums, groups)

---

## 11. Open Questions

1. **Agent distribution:** Should we distribute via a simple .exe installer, or use something like WinGet / Microsoft Store?
2. **Anti-cheat concerns:** Some games with anti-cheat (Vanguard, EAC) may flag process scanning. Need to research how to coexist safely.
3. **Game metadata source:** IGDB is the best free option, but rate limits may be an issue at scale. Consider caching aggressively or building own DB.
4. **Privacy:** How much data do we show on public profiles by default? Lean toward minimal (total hours + top games) with opt-in for more.
5. **Agent auth flow:** How should the Windows agent authenticate? Open browser for email login and pass token back to the agent via localhost callback, or allow entering email/password directly in the agent UI?
6. **Discord bot hosting:** Where should the Discord RP server be hosted? VPS (DigitalOcean, Linode), Railway, Fly.io? Needs persistent connection to Discord Gateway.
7. **Discord bot scaling:** If the Hesoyam Discord server grows large (10k+ members), may need to apply for verified bot status and handle rate limits.
8. **Discord User ID verification:** Currently skipping verification for MVP. Future: add verification via DM code or slash command?
