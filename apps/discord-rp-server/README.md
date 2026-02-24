# Hesoyam Discord RP Server

Discord Rich Presence tracking server for Hesoyam. Monitors connected users' Discord presence and tracks gaming sessions in Supabase.

## Prerequisites

- Node.js 18+
- Discord Bot with Presence Intent enabled
- Supabase project with the required schema

## Discord Bot Setup

1. Create a Discord Application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Go to **Bot** section and create a bot
3. Enable **Privileged Gateway Intents**:
   - Server Members Intent
   - Presence Intent
4. Copy the bot token
5. Go to **OAuth2 > URL Generator**:
   - Select `bot` scope
   - Select permissions: View Channels, Read Message History
   - Use the generated URL to add the bot to your Hesoyam Discord server

## Setup

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```

2. Fill in the environment variables:
   ```env
   DISCORD_BOT_TOKEN=your_bot_token
   DISCORD_GUILD_ID=your_hesoyam_server_id
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_KEY=your_service_role_key
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Run the database migration:
   ```bash
   supabase db push
   ```

## Usage

### Development

```bash
pnpm dev
```

### Production

```bash
pnpm build
pnpm start
```

## Architecture

```
src/
├── index.ts              # Entry point
├── config/
│   └── env.ts            # Environment configuration
├── discord/
│   ├── client.ts         # Discord.js client setup
│   └── events/
│       ├── ready.ts      # Bot ready handler
│       └── presence-update.ts  # Presence change handler
├── supabase/
│   ├── client.ts         # Supabase client
│   ├── sessions.ts       # Session CRUD operations
│   └── users.ts          # User/profile operations
├── services/
│   ├── session-tracker.ts    # Session tracking logic
│   ├── user-cache.ts         # In-memory user cache
│   └── presence-broadcaster.ts # Realtime presence broadcasts
├── utils/
│   └── logger.ts         # Logging utility
└── types/
    └── index.ts          # TypeScript types
```

## How It Works

1. **Startup**: Loads all users with connected Discord IDs into memory cache
2. **Realtime Subscription**: Subscribes to profile updates to catch new Discord connections
3. **Presence Monitoring**: Listens for `presenceUpdate` events from Discord Gateway
4. **Session Tracking**: Creates/closes sessions in Supabase based on game activity
5. **Agent Priority**: Checks `agent_last_seen` before tracking - if desktop agent is active, Discord tracking is skipped
6. **Broadcasting**: Sends presence updates via Supabase Realtime for dashboard

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_BOT_TOKEN` | Yes | Discord bot token |
| `DISCORD_GUILD_ID` | Yes | Hesoyam Discord server ID |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `LOG_LEVEL` | No | Logging level (debug/info/warn/error) |
| `AGENT_TIMEOUT_MS` | No | Agent heartbeat timeout in ms (default: 60000) |

## Deployment

The server needs to maintain a persistent connection to Discord's Gateway. Recommended hosting:

- **Railway** - Easy deployment, persistent connections
- **Fly.io** - Good for long-running processes
- **DigitalOcean App Platform** - Supports worker processes
- **VPS** - DigitalOcean, Linode, Vultr with PM2 or systemd
