# RAID Mobile App V1 — Product Requirements Document

**Target launch:** April 30, 2026
**Platform:** iOS + Android (Flutter)
**Author:** Ijas / Claude

---

## 1. Product Vision

RAID Mobile is the primary way gamers interact with RAID. You play on PC — you check stats on your phone. No alt-tabbing, no minimizing. Open phone, see your session live.

The mobile app replaces the web dashboard as the main consumer-facing product.

## 2. V1 Scope

**In scope:**
- Discord OAuth login
- Live session tracking (real-time)
- Dashboard with gaming stats
- Game library with per-game detail
- Session history
- Push notifications (session end summary)

**Out of scope (V2+):**
- Social features (follow friends, activity feeds)
- Wrapped / year-end summaries
- Manual session logging / editing
- Game library management (backlog, completed, want-to-play status editing)
- Settings beyond basic profile

---

## 3. Screens

### 3.1 Auth — Login Screen

**Purpose:** Get the user into the app. Discord is the only auth provider (every RAID user has Discord since tracking depends on it).

**UI:**
- RAID logo + tagline
- "Sign in with Discord" button (primary CTA)
- Minimal — no email/password, no signup form

**Flow:**
1. Tap "Sign in with Discord"
2. Opens Discord OAuth in system browser / webview
3. Redirect back to app with auth code
4. Exchange code for Supabase session
5. Check if profile has `username` set → if not, go to username setup
6. Otherwise → Home

**Tech:**
- Supabase Flutter SDK: `supabase.auth.signInWithOAuth(OAuthProvider.discord)`
- Deep link callback: `com.rfrsh.raid://callback`
- Scopes: `identify email guilds.members.read`

---

### 3.2 Username Setup (one-time)

**Purpose:** New users need to pick a username on first login.

**UI:**
- "Pick your username" heading
- Username text input with validation (unique, lowercase, no special chars)
- "Continue" button

**Flow:**
1. User enters username
2. Client checks uniqueness against `profiles` table
3. Updates `profiles.username`
4. Navigate to Home

---

### 3.3 Home / Dashboard

**Purpose:** The main screen. Shows your gaming life at a glance.

**Layout (top to bottom):**

1. **Header bar**
   - "RAID" wordmark (left)
   - Avatar (right, taps to Profile)

2. **Live Session Card** (conditional — only when playing)
   - Game cover art (large, background blur)
   - Game name
   - "Playing for" + live elapsed timer (ticks every second)
   - Subtle pulsing glow / animation to indicate "live"

3. **"Not Playing" state** (when no live session)
   - Last played game card
   - Game cover art + name
   - "Played for X hours" + "X hours ago"

4. **Stats row** (horizontal scroll or grid)
   - Today: Xh Xm
   - This Week: Xh Xm
   - This Month: Xh Xm
   - All Time: Xh Xm

5. **Week Streak**
   - Current week streak count
   - 7-day bar (Sun–Sat) showing tracked / missed / upcoming

6. **Recent Plays** (vertical list, last 4-5 sessions)
   - Game cover thumbnail + name
   - Duration + relative date ("Today", "Yesterday", "Apr 15")

**Data sources:**
- Live session: Supabase Realtime broadcast on `presence:${userId}` channel, event `game_presence`
- Stats: `get_dashboard_overview(p_user_id)` RPC
- All time: SUM of `game_sessions.duration_secs` WHERE `ended_at IS NOT NULL`
- Streak: `game_sessions.started_at` grouped by week
- Recent plays: `game_sessions` joined with `games`, ordered by `started_at DESC`, limit 5, `ended_at IS NOT NULL`

**Live session behavior:**
- Subscribe to `presence:${userId}` Supabase Broadcast channel
- On `start` / `heartbeat` event → show live card with timer
- On `end` event → hide live card, refresh dashboard data
- Staleness: if no heartbeat for 45s, check DB for `ended_at IS NULL` session before hiding
- Timer: client-side calculation from `started_at`, updates every second

---

### 3.4 Game Library

**Purpose:** See all games you've played, sorted by most played.

**UI:**
- Grid of game cover art cards (2 columns)
- Each card: cover art, game name, total playtime
- Sorted by total playtime (descending)
- Pull-to-refresh
- Tap → Game Detail

**Data source:**
- `user_games` joined with `games`, ordered by `total_time_secs DESC`
- Query: `supabase.from('user_games').select('*, games(*)').eq('user_id', userId).order('total_time_secs', ascending: false)`

---

### 3.5 Game Detail

**Purpose:** Deep dive into a specific game's stats and session history.

**Layout:**
1. **Hero section**
   - Game cover art / artwork (full-width)
   - Game name
   - Developer / publisher
   - Genre tags

2. **Stats cards**
   - Total playtime
   - Total sessions
   - Average session length
   - First played date
   - Last played date

3. **Session history** (scrollable list)
   - Date + time
   - Duration
   - Most recent first

**Data sources:**
- Game metadata: `games` table row
- Stats: `user_games` row (total_time_secs, total_sessions, avg_session_secs, first_played, last_played)
- Sessions: `game_sessions` WHERE `game_id = X` AND `user_id = Y`, ordered by `started_at DESC`

---

### 3.6 Profile

**Purpose:** Basic profile info and app settings.

**Layout:**
1. **Profile header**
   - Avatar (from Discord)
   - Display name
   - Username (@batman)
   - Member since date

2. **Quick stats**
   - Total games played
   - Total playtime
   - Total sessions

3. **Actions**
   - Sign out

**Data sources:**
- `profiles` table row
- Aggregate from `user_games`: COUNT for game count, SUM for total time, SUM for sessions

---

## 4. Navigation

**Bottom tab bar (3 tabs):**

| Tab | Icon | Screen |
|-----|------|--------|
| Home | Home/Dashboard icon | Dashboard |
| Library | Grid/Gamepad icon | Game Library |
| Profile | User icon | Profile |

Simple. Three tabs. No hamburger menus, no drawers.

---

## 5. Design Direction

- **Dark mode only** — gamers expect dark UIs, no light mode in V1
- **Color palette:** Deep blacks/grays + one accent color (RAID brand color TBD)
- **Typography:** Clean sans-serif, bold headings, mono for timers/numbers
- **Cover art is king** — game covers should be prominent everywhere, they're the visual identity
- **Animations:** Subtle. Live session pulsing glow. Smooth page transitions. Nothing flashy.
- **Inspiration:** Spotify (dark, content-forward), Steam mobile (game-focused), Apple Health (clean stats)

---

## 6. Technical Architecture

### 6.1 Stack
- **Framework:** Flutter (Dart)
- **State management:** Riverpod (or Provider — TBD)
- **Backend:** Supabase Flutter SDK (direct DB reads via PostgREST + Realtime)
- **Auth:** Supabase Auth with Discord OAuth
- **Push notifications:** Firebase Cloud Messaging (FCM)
- **Deep links:** `com.rfrsh.raid://` scheme

### 6.2 Data Flow
```
Discord Rich Presence
    ↓
Discord Bot (discord-rp-server)
    ↓
NestJS Backend API (session start/heartbeat/end)
    ↓
Supabase DB (game_sessions, games, user_games)
    ↓                          ↓
Supabase Realtime          Supabase PostgREST
(live presence broadcast)  (REST queries)
    ↓                          ↓
    └──── Flutter Mobile App ──┘
```

The mobile app is a **read client**. It never creates or modifies sessions. All writes come from the Discord bot → NestJS backend pipeline.

### 6.3 Supabase Integration

**Client init:**
```dart
final supabase = Supabase.instance.client;
// URL: same NEXT_PUBLIC_SUPABASE_URL
// Anon Key: same NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**Live presence subscription:**
```dart
supabase.channel('presence:$userId')
  .onBroadcast(event: 'game_presence', callback: (payload) {
    // payload: { user_id, game_id, game_name, game_slug, cover_url, started_at, event }
    if (payload['event'] == 'end') clearLiveSession();
    else setLiveSession(payload);
  })
  .subscribe();
```

**Existing RPC functions the app can use:**
- `get_dashboard_overview(p_user_id)` → today/week/month stats
- `get_calendar_data(p_user_id, p_year, p_month)` → day heatmap (V2 maybe)
- `get_genre_stats(p_user_id)` → genre breakdown (V2 maybe)

### 6.4 Auth Flow (Flutter)
1. `supabase.auth.signInWithOAuth(OAuthProvider.discord)` — opens browser
2. Browser redirects to `com.rfrsh.raid://callback?code=XXX`
3. Flutter deep link handler catches redirect
4. `supabase.auth.exchangeCodeForSession(code)` — creates session
5. Check `profiles.username` — if null, show username setup
6. Navigate to Home

### 6.5 Push Notifications
- When a session ends, the backend can trigger a push notification
- Requires: FCM setup, storing device tokens in a new `device_tokens` table
- Notification content: "You played {game_name} for {duration}"
- **Note:** This requires a small backend addition — a webhook/trigger on session end. Can be a V1.1 fast-follow if it delays launch.

### 6.6 Dart Models (from existing DB schema)

```dart
class Profile {
  final String id;
  final String? email;
  final String? username;
  final String? displayName;
  final String? avatarUrl;
  final String? bio;
  final String? discordId;
  final String role;
  final DateTime createdAt;
}

class Game {
  final String id;
  final int? igdbId;
  final String name;
  final String slug;
  final String? coverUrl;
  final List<String>? genres;
  final String? developer;
  final String? publisher;
  final int? releaseYear;
  final String? artworkUrl;
  final DateTime createdAt;
}

class GameSession {
  final String id;
  final String userId;
  final String? gameId;
  final String? gameName;
  final String source; // 'discord' | 'agent'
  final DateTime startedAt;
  final DateTime? endedAt;
  final int durationSecs;
  final int activeSecs;
  final int idleSecs;
}

class UserGame {
  final String userId;
  final String gameId;
  final int totalTimeSecs;
  final int totalSessions;
  final int avgSessionSecs;
  final DateTime? firstPlayed;
  final DateTime? lastPlayed;
}
```

---

## 7. Project Structure

```
apps/mobile_app/
├── lib/
│   ├── main.dart
│   ├── app.dart                    # MaterialApp, routing, theme
│   ├── core/
│   │   ├── supabase/
│   │   │   └── client.dart         # Supabase init
│   │   ├── theme/
│   │   │   └── app_theme.dart      # Dark theme, colors, typography
│   │   └── router/
│   │       └── app_router.dart     # Route definitions
│   ├── models/
│   │   ├── profile.dart
│   │   ├── game.dart
│   │   ├── game_session.dart
│   │   └── user_game.dart
│   ├── services/
│   │   ├── auth_service.dart       # Discord OAuth flow
│   │   ├── presence_service.dart   # Realtime broadcast subscription
│   │   └── dashboard_service.dart  # RPC calls, data fetching
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── login_screen.dart
│   │   │   └── username_setup_screen.dart
│   │   ├── home/
│   │   │   └── home_screen.dart
│   │   ├── library/
│   │   │   ├── library_screen.dart
│   │   │   └── game_detail_screen.dart
│   │   └── profile/
│   │       └── profile_screen.dart
│   └── widgets/
│       ├── live_session_card.dart
│       ├── stat_card.dart
│       ├── game_cover_card.dart
│       ├── session_list_item.dart
│       └── streak_bar.dart
├── pubspec.yaml
├── android/
├── ios/
└── PRD.md (this file)
```

---

## 8. Dependencies (pubspec.yaml)

```yaml
dependencies:
  flutter:
    sdk: flutter
  supabase_flutter: ^2.0.0      # Supabase client + auth + realtime
  flutter_riverpod: ^2.0.0       # State management
  go_router: ^14.0.0             # Routing
  cached_network_image: ^3.0.0   # Game cover image caching
  intl: ^0.19.0                  # Date/time formatting
  google_fonts: ^6.0.0           # Typography
  shimmer: ^3.0.0                # Loading skeletons
  url_launcher: ^6.0.0           # Open links
```

---

## 9. 10-Day Build Plan

| Day | Focus | Deliverable |
|-----|-------|-------------|
| 1 | Project setup | Flutter project, Supabase SDK, theme, routing, models |
| 2 | Auth | Discord OAuth login, username setup, session persistence |
| 3 | Home — static | Dashboard layout, stats row, streak bar, recent plays (mock → real data) |
| 4 | Home — live session | Realtime presence subscription, live timer, session card |
| 5 | Game Library | Grid view, cover art cards, sorting, pull-to-refresh |
| 6 | Game Detail | Hero section, stats cards, session history list |
| 7 | Profile | Profile screen, sign out, quick stats |
| 8 | Polish | Animations, loading states, error handling, empty states |
| 9 | Push notifications | FCM setup, device token storage, session-end notification (or defer to V1.1) |
| 10 | Launch prep | TestFlight build, APK, final bugs, app store screenshots |

---

## 10. Open Questions

1. **State management:** Riverpod vs Provider vs Bloc? Riverpod is modern and testable, but if you have a preference let's go with that.
2. **Package name / bundle ID:** `com.rfrsh.raid`? Something else?
3. **App Store presence:** Are we launching on TestFlight first, or straight to App Store / Play Store?
4. **Brand color:** What's RAID's accent color? Need this for the theme.
5. **Push notifications in V1 or V1.1?** Requires backend changes (device token table + trigger). Could delay launch by 1-2 days.
6. **Offline support:** Should the app cache data for offline viewing, or require connectivity? Recommend: online-only for V1, cache game covers only.
7. **Analytics:** Do we want basic usage analytics (screen views, DAU) from day 1? Firebase Analytics is free and easy.
