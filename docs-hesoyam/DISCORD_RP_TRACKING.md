# Discord Rich Presence Tracking System

## Overview

An alternative tracking method that monitors users' Discord Rich Presence to track gaming sessions. This complements the desktop agent by providing a zero-install tracking option that also supports console games (PlayStation, Xbox) when connected to Discord.

**Last Updated:** 2026-02-04

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Hesoyam Discord Server                      │
│                 (users must join to be tracked)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 apps/discord-rp-server                       │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ Discord Bot  │→ │ Session Tracker │→ │    Supabase     │  │
│  │ (discord.js) │  │ (game detection)│  │  (DB + Realtime)│  │
│  └──────────────┘  └────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Supabase Broadcast)
┌─────────────────────────────────────────────────────────────┐
│                    apps/web (Dashboard)                      │
│               Shows real-time presence + stats               │
└─────────────────────────────────────────────────────────────┘
```

---

## User Flow

```
1. User signs up on hesoyam.gg
                │
                ▼
2. User goes to Settings → "Connect Discord"
                │
                ▼
3. User joins the Hesoyam Discord server
                │
                ▼
4. User enters their Discord User ID
   (Once submitted, this field is locked/immutable)
                │
                ▼
5. Bot starts monitoring user's Rich Presence
                │
                ▼
6. When user plays a game (detected by Discord)
   → Session created in Supabase
   → Dashboard updates in real-time
```

---

## Database Schema Changes

```sql
-- Add Discord connection fields to profiles
ALTER TABLE profiles
  ADD COLUMN discord_id TEXT UNIQUE,
  ADD COLUMN discord_connected_at TIMESTAMPTZ;

-- Add agent heartbeat for priority detection
ALTER TABLE profiles
  ADD COLUMN agent_last_seen TIMESTAMPTZ;

-- Enforce one active session per user
CREATE UNIQUE INDEX unique_user_active_session
  ON game_sessions (user_id)
  WHERE ended_at IS NULL;

-- Track session source and allow nullable game_id for Discord
ALTER TABLE game_sessions
  ADD COLUMN source TEXT DEFAULT 'agent'
  CHECK (source IN ('agent', 'discord')),
  ADD COLUMN game_name TEXT,
  ALTER COLUMN game_id DROP NOT NULL;
```

### Discord vs Agent Session Data

| Field | Agent Sessions | Discord Sessions |
|-------|---------------|------------------|
| `game_id` | Set (FK to games table) | `NULL` |
| `game_name` | `NULL` (use games.name) | Set (from Discord) |
| `source` | `'agent'` | `'discord'` |
| `user_games` updated | Yes (on session close) | No (skipped) |
| IGDB matching | Yes | No |

**Why no IGDB matching for Discord?**
- Discord game names don't always match IGDB exactly
- Adds latency and complexity for MVP
- Users still see their playtime; just no cover art/metadata
- Future: could add optional IGDB matching

---

## Session Tracking Rules

### Rule 1: One Active Session Per User

A user can only have ONE active session at any time. The database enforces this with a unique partial index.

- If user switches games → previous session closes, new session opens
- No duplicate sessions possible

### Rule 2: Agent Has Priority

When both tracking methods are available, the desktop agent takes priority because it offers:
- Idle detection
- Pause/resume functionality
- Offline support
- Custom game tracking

**Priority Logic:**

```
Discord RP receives presence update
            │
            ▼
    Is agent_last_seen < 60s ago?
            │
     ┌──────┴──────┐
     │ YES         │ NO
     ▼             ▼
   SKIP         Continue
   (Agent is    tracking
   handling it)
```

### Rule 3: Agent Takes Over Discord Sessions

When the desktop agent starts while a Discord-tracked session is active:

1. Agent detects game is running
2. Agent checks for existing active session
3. If session exists with `source = 'discord'`:
   - Agent takes over by setting `source = 'agent'`
   - Agent now owns the session (updates duration, handles idle, etc.)
4. Discord RP server, on next update, sees `source = 'agent'` and stops tracking

---

## Discord RP Server Implementation

### Project Structure

```
apps/discord-rp-server/
├── src/
│   ├── index.ts                 # Entry point
│   ├── discord/
│   │   ├── client.ts            # Discord.js client setup
│   │   └── presence-handler.ts  # Presence event handling
│   ├── supabase/
│   │   ├── client.ts            # Supabase client
│   │   ├── sessions.ts          # Session CRUD operations
│   │   └── users.ts             # User/profile operations
│   ├── tracker/
│   │   ├── session-manager.ts   # Active session tracking
│   │   └── game-detector.ts     # Extract game from presence
│   └── cache/
│       └── monitored-users.ts   # In-memory user cache
├── package.json
├── tsconfig.json
└── .env
```

### Environment Variables

```env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=hesoyam_server_id
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
```

### Core Logic

#### 1. Startup: Load Monitored Users

```typescript
// Cache all users who have connected their Discord
const monitoredUsers = new Map<string, string>(); // discord_id → user_id

async function loadMonitoredUsers() {
  const { data } = await supabase
    .from('profiles')
    .select('id, discord_id')
    .not('discord_id', 'is', null);

  data?.forEach(user => {
    monitoredUsers.set(user.discord_id, user.id);
  });

  console.log(`Loaded ${monitoredUsers.size} monitored users`);
}
```

#### 2. Listen for New Connections via Realtime

```typescript
// Subscribe to profile updates for new Discord connections
supabase
  .channel('discord-connections')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'profiles',
  }, (payload) => {
    const { old: oldRow, new: newRow } = payload;

    // New Discord connection
    if (!oldRow.discord_id && newRow.discord_id) {
      monitoredUsers.set(newRow.discord_id, newRow.id);
      console.log(`New user connected: ${newRow.discord_id}`);
    }
  })
  .subscribe();
```

#### 3. Handle Presence Updates

```typescript
client.on('presenceUpdate', async (oldPresence, newPresence) => {
  if (!newPresence?.userId) return;

  const discordId = newPresence.userId;
  const hesoyamUserId = monitoredUsers.get(discordId);

  // Not a Hesoyam user
  if (!hesoyamUserId) return;

  // Check if agent is active (has priority)
  if (await isAgentActive(hesoyamUserId)) {
    return; // Agent is handling it
  }

  // Extract game activity (type 0 = Playing)
  const oldGame = getPlayingActivity(oldPresence);
  const newGame = getPlayingActivity(newPresence);

  // Detect game start/end/switch
  await handleGameChange(hesoyamUserId, oldGame, newGame);
});

function getPlayingActivity(presence: Presence | null) {
  return presence?.activities.find(a => a.type === 0) || null;
}
```

#### 4. Agent Priority Check

```typescript
async function isAgentActive(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('agent_last_seen')
    .eq('id', userId)
    .single();

  if (!data?.agent_last_seen) return false;

  const lastSeen = new Date(data.agent_last_seen);
  const threshold = new Date(Date.now() - 60_000); // 60 seconds

  return lastSeen > threshold;
}
```

#### 5. Handle Game Changes

```typescript
async function handleGameChange(
  userId: string,
  oldGame: Activity | null,
  newGame: Activity | null
) {
  // Case 1: Game started (no game before, game now)
  if (!oldGame && newGame) {
    await createSession(userId, newGame);
    await broadcastPresence(userId, newGame, 'start');
  }

  // Case 2: Game ended (game before, no game now)
  else if (oldGame && !newGame) {
    await closeSession(userId);
    await broadcastPresence(userId, null, 'end');
  }

  // Case 3: Game switched (different game)
  else if (oldGame && newGame && oldGame.name !== newGame.name) {
    await closeSession(userId);
    await createSession(userId, newGame);
    await broadcastPresence(userId, newGame, 'start');
  }

  // Case 4: Same game (heartbeat/update)
  else if (oldGame && newGame && oldGame.name === newGame.name) {
    // Optional: periodic heartbeat broadcast
  }
}
```

#### 6. Session Operations

```typescript
async function createSession(userId: string, game: Activity) {
  const startedAt = game.timestamps?.start
    ? new Date(game.timestamps.start)
    : new Date();

  // Check for existing session first
  const { data: existing } = await supabase
    .from('game_sessions')
    .select('id')
    .eq('user_id', userId)
    .is('ended_at', null)
    .single();

  if (existing) {
    // Close existing session before creating new one
    await closeSession(userId);
  }

  await supabase.from('game_sessions').insert({
    user_id: userId,
    game_name: game.name,
    started_at: startedAt.toISOString(),
    source: 'discord',
  });
}

async function closeSession(userId: string) {
  const now = new Date();

  const { data: session } = await supabase
    .from('game_sessions')
    .select('id, started_at, source')
    .eq('user_id', userId)
    .is('ended_at', null)
    .single();

  if (!session) return;

  // Only close if we own this session
  if (session.source !== 'discord') return;

  const startedAt = new Date(session.started_at);
  const durationSecs = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

  await supabase
    .from('game_sessions')
    .update({
      ended_at: now.toISOString(),
      duration_secs: durationSecs,
      active_secs: durationSecs, // No idle detection for Discord
      idle_secs: 0,
    })
    .eq('id', session.id);
}
```

#### 7. Broadcast Presence (Real-time)

```typescript
async function broadcastPresence(
  userId: string,
  game: Activity | null,
  event: 'start' | 'end' | 'heartbeat'
) {
  await supabase.channel(`presence:${userId}`).send({
    type: 'broadcast',
    event: 'game_presence',
    payload: {
      user_id: userId,
      event,
      game_name: game?.name || null,
      game_slug: game?.name?.toLowerCase().replace(/\s+/g, '-') || null,
      cover_url: game?.assets?.largeImageURL || null,
      started_at: game?.timestamps?.start || null,
    },
  });
}
```

---

## Agent Changes Required

The desktop agent needs these updates to support priority handoff:

### 1. Update `agent_last_seen` Every Tick

```rust
// In tracking_loop, every 30 seconds
async fn update_heartbeat(supabase: &SupabaseClient, user_id: &str) {
    supabase
        .from("profiles")
        .update(json!({ "agent_last_seen": Utc::now().to_rfc3339() }))
        .eq("id", user_id)
        .execute()
        .await;
}
```

### 2. Take Over Discord Sessions

```rust
async fn start_or_takeover_session(
    supabase: &SupabaseClient,
    user_id: &str,
    game: &Game,
) -> Option<String> {
    // Check for existing active session
    let existing = supabase
        .from("game_sessions")
        .select("id, source")
        .eq("user_id", user_id)
        .is("ended_at", "null")
        .single()
        .await;

    if let Some(session) = existing {
        if session.source == "discord" {
            // Take over Discord session
            supabase
                .from("game_sessions")
                .update(json!({ "source": "agent" }))
                .eq("id", session.id)
                .execute()
                .await;

            return Some(session.id);
        }
        // Already an agent session, return it
        return Some(session.id);
    }

    // No existing session, create new one
    // ... existing create logic
}
```

---

## Web Dashboard Changes

### Settings Page: Connect Discord

```
┌─────────────────────────────────────────────────┐
│  Connect Discord                                │
├─────────────────────────────────────────────────┤
│                                                 │
│  Track your gaming activity via Discord Rich   │
│  Presence. Works with PC games and consoles    │
│  connected to Discord.                         │
│                                                 │
│  Step 1: Join the Hesoyam Discord Server       │
│  [Join Server] (link to discord.gg/hesoyam)    │
│                                                 │
│  Step 2: Enter your Discord User ID            │
│  ┌─────────────────────────────────────────┐   │
│  │ 123456789012345678                      │   │
│  └─────────────────────────────────────────┘   │
│  How to find your User ID? (help link)         │
│                                                 │
│  [Connect Discord]                              │
│                                                 │
│  ⚠️ Once connected, your Discord ID cannot     │
│     be changed.                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### After Connection

```
┌─────────────────────────────────────────────────┐
│  Discord Connected ✓                            │
├─────────────────────────────────────────────────┤
│                                                 │
│  Discord ID: 123456789012345678                 │
│  Connected: Feb 4, 2026                         │
│                                                 │
│  Your gaming activity will be tracked when     │
│  you're in the Hesoyam Discord server and      │
│  Discord detects a game.                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Comparison: Agent vs Discord RP

| Feature | Desktop Agent | Discord RP |
|---------|---------------|------------|
| **Installation** | Required | None |
| **Offline gaming** | ✅ Yes | ❌ No |
| **Console games** | ❌ No | ✅ Yes (if Discord connected) |
| **Idle detection** | ✅ Yes | ❌ No |
| **Pause/Resume** | ✅ Yes | ❌ No |
| **Custom game tracking** | ✅ Yes | ❌ No |
| **Works without Discord** | ✅ Yes | ❌ No |
| **Requires Discord server** | ❌ No | ✅ Yes |

---

## Discord Bot Setup

### Required Permissions

- **Server Members Intent** (Privileged)
- **Presence Intent** (Privileged)
- View Channels
- Read Message History

### Bot Invite URL Scopes

- `bot`
- `applications.commands` (if adding slash commands later)

### Bot Permissions Integer

- View Channels: 1024
- Read Message History: 65536
- **Total: 66560**

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User not in Hesoyam server | Not tracked (bot can't see presence) |
| User set to Invisible | Not tracked (no presence data) |
| User disabled "Display activity" | Not tracked |
| User leaves server | Tracking stops |
| Bot goes offline | Sessions may be orphaned (use stale session cleanup) |
| Multiple games at once | Track first "Playing" activity |

---

## Deployment

The Discord RP server should run as a persistent service:

- **Development:** `npm run dev` (local)
- **Production:** Deploy to VPS, Railway, Fly.io, or similar
- **Requirements:** Node.js 18+, persistent connection to Discord Gateway

### Health Checks

```typescript
// Expose health endpoint for monitoring
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    discord: client.isReady(),
    monitoredUsers: monitoredUsers.size,
    uptime: process.uptime(),
  });
});
```

---

## Implementation Status

✅ **Completed:**
- Discord RP Server (`apps/discord-rp-server/`)
- User cache with Realtime subscription for new connections
- Presence monitoring and session tracking
- Agent priority check (defers when agent active)
- Supabase Broadcast for real-time dashboard updates
- Settings UI: Discord connection flow
- Settings UI: Tracking status display
- Dashboard: Live session card (handles Discord sessions)
- Dashboard: Recent sessions (handles Discord sessions)
- Journal: Day sessions (handles Discord sessions)
- Public profile: Currently playing (handles Discord sessions)
- Database triggers skip `user_games` for Discord sessions

⏳ **Not Yet Implemented:**
- Agent heartbeat (`agent_last_seen` updates)
- Agent taking over Discord sessions

---

## Future Improvements

1. **Slash commands** - `/connect` command to link accounts from Discord
2. **DM notifications** - Notify users when sessions are tracked
3. **Multiple Discord accounts** - Support linking multiple Discord IDs
4. **Activity type expansion** - Track Spotify listening, streaming, etc.
5. **IGDB matching** - Optional matching for Discord game names to get cover art
