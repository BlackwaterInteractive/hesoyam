# Hesoyam - Gaming Journal & Wrapped Platform

## Product Requirements Document (MVP)

**Version:** 0.1.0
**Last Updated:** 2026-01-26
**Author:** ijuice

---

## 1. Vision

Hesoyam is a personal gaming journal that automatically tracks what you play, how long you play, and turns that data into shareable year-end (and monthly) "Wrapped" experiences. Think Spotify Wrapped, but for your gaming life.

**Tagline:** _Your gaming year, wrapped._

**MVP Scope:** Windows tracking agent + Web dashboard

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
| **Game Detection** | Detect running game processes by matching against a known game database + user-confirmed unknowns | P0 |
| **Session Tracking** | Log session start, end, and duration with idle detection | P0 |
| **System Tray App** | Minimal UI — tray icon with status, pause/resume, current session info | P0 |
| **Auto-Start** | Option to launch on Windows startup | P1 |
| **Manual Game Add** | User can manually tag an unrecognized process as a game | P1 |
| **Cloud Sync** | Push session data to Hesoyam API in real-time | P0 |
| **Offline Support** | Queue sessions locally when offline, sync when back online | P1 |
| **Low Resource Usage** | < 50MB RAM, < 1% CPU at all times | P0 |

#### Game Detection Strategy

```
1. Poll running processes every 30 seconds
2. Match process names against known game database
   - Source: IGDB + manually curated list
   - Examples: "witcher3.exe" -> "The Witcher 3: Wild Hunt"
3. For unmatched processes:
   - Check if the exe is inside a known game directory
     (Steam/steamapps, Epic Games, Xbox, etc.)
   - If found, prompt user to confirm & name it
4. User can manually add any process as a tracked game
5. Maintain a local + cloud "game signature" database that
   improves over time (community-contributed)
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

### 4.2 Web Dashboard

The primary interface for viewing stats, managing your profile, and generating Wrapped content.

#### 4.2.1 Authentication

| Feature | Description | Priority |
|---------|-------------|----------|
| **Email + Password** | Primary sign-in via Supabase Auth (email/password with email verification) | P0 |
| **Magic Link** | Passwordless sign-in option via Supabase Auth | P1 |

#### 4.2.2 Dashboard Home

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

#### 4.2.3 Game Library

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

#### 4.2.4 Stats & Insights

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

#### 4.2.5 Calendar / Journal View

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

#### 4.2.6 Profile Page (Public)

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

### 4.3 Settings & Account

| Feature | Description | Priority |
|---------|-------------|----------|
| **Profile editing** | Display name, bio, avatar upload | P0 |
| **Privacy controls** | Profile visibility: public / friends-only / private | P1 |
| **Connected accounts** | Steam (for importing historical data) | P1 |
| **Steam import** | One-time import of play time from Steam API | P1 |
| **Notification prefs** | Toggle session summaries, weekly recaps, milestones | P1 |
| **Data export** | Download all your data as JSON/CSV | P2 |
| **Delete account** | Full data deletion | P1 |

---

## 5. Technical Architecture (High Level)

```
                    +------------------+
                    |  Windows Agent   |
                    |  (Rust / Tauri)  |
                    +--------+---------+
                             |
                         REST API
                             |
                    +--------v---------+
                    |    Supabase      |
                    |  +------------+  |
                    |  | Auth       |  |
                    |  | PostgreSQL |  |
                    |  | Edge Fns   |  |
                    |  | Storage    |  |
                    |  +------------+  |
                    +--+----------+----+
                       |          |
                       |    +----v----------+
                       |    | Redis         |
                       |    | (real-time    |
                       |    |  presence,    |
                       |    |  caching)     |
                       |    +---------------+
                       |
                    +--v---------------+
                    |  Web Dashboard   |
                    |  (Next.js)       |
                    +------------------+
```

### Tech Stack (Proposed)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Windows Agent** | Rust + Tauri | Low resource usage, native system tray, cross-compile potential for future Mac support |
| **Backend** | Supabase (PostgreSQL + Edge Functions) | Auth, DB, storage, and serverless functions in one platform. Less infra to manage for MVP |
| **Database** | Supabase PostgreSQL | Relational data with Row Level Security (RLS), real-time subscriptions |
| **Cache / Real-time** | Redis | Presence status, caching, rate limiting |
| **Web Dashboard** | Next.js (App Router) | SSR for public profiles, React for dashboard |
| **Auth** | Supabase Auth (email/password + magic link) | Built-in auth with email verification, session management, and RLS |
| **Game Metadata** | IGDB API | Cover art, genres, release dates, platform info |
| **Hosting** | Vercel (web) + Supabase (backend) | Simple deployment, generous free tiers |
| **File Storage** | Supabase Storage | Wrapped images, avatars — integrated with auth & RLS |

### Key Data Models

```
User (extends Supabase auth.users)
  id              UUID (FK -> auth.users.id)
  email           String (unique, from Supabase Auth)
  username        String (unique, hesoyam handle)
  display_name    String
  avatar_url      String
  bio             String
  privacy         Enum (public, friends_only, private)
  created_at      DateTime
  updated_at      DateTime

Game
  id              UUID
  igdb_id         Int (nullable, linked to IGDB)
  name            String
  slug            String
  cover_url       String
  genres          String[] (from IGDB)
  developer       String
  release_year    Int
  process_names   String[] (e.g., ["witcher3.exe", "witcher3_dx11.exe"])
  created_at      DateTime

GameSession
  id              UUID
  user_id         UUID (FK -> User)
  game_id         UUID (FK -> Game)
  started_at      DateTime
  ended_at        DateTime (nullable if live)
  duration_secs   Int (total)
  active_secs     Int (excluding idle)
  idle_secs       Int
  created_at      DateTime

  @@index([user_id, started_at])
  @@index([user_id, game_id])

UserGame (aggregated stats, updated on session end)
  user_id         UUID (FK -> User)
  game_id         UUID (FK -> Game)
  total_time_secs Int
  total_sessions  Int
  first_played    DateTime
  last_played     DateTime
  avg_session_secs Int

  @@id([user_id, game_id])

ProcessSignature (community game detection)
  id              UUID
  process_name    String
  game_id         UUID (FK -> Game)
  reported_by     UUID (FK -> User)
  confirmed_count Int (how many users confirmed this mapping)
  status          Enum (pending, approved, rejected)
  created_at      DateTime

  @@unique([process_name, game_id])
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

### Game Detection
```
GET    /api/detect/signatures         -> Download game signature DB
POST   /api/detect/report             -> Report a new process->game mapping
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
6. Prompt: "Download the Hesoyam tracker for Windows"
7. User downloads + installs the agent
8. Agent asks user to sign in (opens browser, same email auth)
9. Agent starts tracking
10. First session appears on dashboard in real-time
```

### 7.2 Daily Usage

```
1. User boots PC -> Hesoyam agent starts automatically
2. User launches a game
3. Agent detects game process, starts session
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
- [ ] Game signature database (seed with top 200 PC games)

### Milestone 2: Windows Agent
- [ ] Process detection engine
- [ ] Game matching against signature DB
- [ ] Session tracking with idle detection
- [ ] System tray UI
- [ ] Cloud sync (real-time + offline queue)
- [ ] Auto-start on boot
- [ ] Installer / auto-updater

### Milestone 3: Web Dashboard
- [ ] Dashboard home (overview + recent sessions)
- [ ] Game library page
- [ ] Game detail page
- [ ] Calendar / journal view
- [ ] Stats & insights page
- [ ] Profile page (public)
- [ ] Settings page

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
- Integration with console platforms (PlayStation, Xbox, Nintendo)
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
