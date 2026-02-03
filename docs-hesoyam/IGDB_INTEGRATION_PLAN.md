# IGDB API Integration Plan

## Overview

This document outlines the plan to integrate the IGDB (Internet Game Database) API into Hesoyam for enriched game metadata, cover art, and automatic game identification.

## Current State

### Existing Schema
The `games` table already includes an `igdb_id` column:
```sql
create table public.games (
  id uuid primary key,
  igdb_id integer unique,  -- Already prepared for IGDB
  name text not null,
  slug text unique not null,
  cover_url text,
  genres text[] default '{}',
  developer text,
  release_year integer,
  created_at timestamptz
);
```

### Current Limitations
- Games are manually added to the database
- Cover images require manual URL entry
- No standardized genre taxonomy
- Limited metadata (missing: description, platforms, publishers, screenshots)
- Process signature mapping is manual

---

## IGDB API Overview

### Authentication
- **Provider**: Twitch Developer Portal (IGDB is owned by Twitch/Amazon)
- **Flow**: OAuth2 Client Credentials
- **Required**: Client ID + Client Secret from Twitch Developer Console
- **Token Endpoint**: `https://id.twitch.tv/oauth2/token`
- **Token Lifetime**: ~60 days (must refresh)

### Rate Limits
| Tier | Requests/Second | Monthly Limit |
|------|-----------------|---------------|
| Free | 4 req/s | Unlimited |

### Base URL
```
https://api.igdb.com/v4/
```

### Query Language
IGDB uses **Apicalypse** - a custom query language similar to GraphQL:
```
fields name, cover.url, genres.name;
search "Counter-Strike";
limit 10;
```

### Key Endpoints
| Endpoint | Description |
|----------|-------------|
| `/games` | Game metadata |
| `/covers` | Cover art images |
| `/genres` | Genre definitions |
| `/platforms` | Platform info |
| `/companies` | Developers/Publishers |
| `/involved_companies` | Game-company relationships |
| `/screenshots` | Game screenshots |
| `/artworks` | Promotional artwork |

---

## Integration Goals

### Phase 1: Game Search & Metadata Enrichment
- Search IGDB by game name
- Auto-populate game metadata from IGDB
- Fetch high-quality cover art

### Phase 2: Process Name Matching
- Use IGDB's alternative names and executable names
- Improve automatic game detection accuracy

### Phase 3: Enhanced Game Profiles
- Add descriptions, screenshots, platforms
- Link to external resources (websites, stores)

---

## Proposed Schema Changes

### New Columns for `games` Table
```sql
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS
  description text,
  publisher text,
  platforms text[] default '{}',
  screenshots text[] default '{}',
  artwork_url text,
  igdb_url text,
  rating numeric(4,2),
  rating_count integer,
  first_release_date timestamptz,
  igdb_updated_at timestamptz,  -- Track when data was last synced
  metadata_source text default 'manual';  -- 'manual' | 'igdb'
```

### New Table: `igdb_alternative_names`
For improved process matching:
```sql
CREATE TABLE public.igdb_alternative_names (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  igdb_id integer not null,
  name text not null,
  name_type text,  -- 'alternative', 'abbreviation', 'expansion', etc.
  created_at timestamptz default now()
);

CREATE INDEX idx_alt_names_name ON public.igdb_alternative_names
  USING gin (lower(name) gin_trgm_ops);
```

---

## Architecture

### Option A: Edge Function (Recommended)
```
┌─────────────┐     ┌──────────────────┐     ┌──────────┐
│ Web/Desktop │────▶│ Supabase Edge Fn │────▶│ IGDB API │
└─────────────┘     │  (igdb-search)   │     └──────────┘
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   PostgreSQL     │
                    │   (cache/store)  │
                    └──────────────────┘
```

**Pros:**
- Credentials stay server-side (secure)
- Can implement caching at edge
- Centralized rate limiting
- Single source of truth

**Cons:**
- Additional latency
- Edge function cold starts

### Option B: Direct Client Calls (Desktop Only)
```
┌─────────────┐     ┌──────────┐
│   Desktop   │────▶│ IGDB API │
│   (Rust)    │     └──────────┘
└─────────────┘
```

**Pros:**
- Lower latency for desktop
- Offline caching in SQLite

**Cons:**
- Credentials in desktop app (security risk)
- Duplicate implementation
- Harder to manage rate limits

### Recommendation
Use **Option A** (Edge Function) as the primary integration point. Desktop can cache results locally but always fetches via the edge function.

---

## New Edge Functions

### 1. `igdb-search`
Search for games by name.

**Request:**
```typescript
POST /functions/v1/igdb-search
{
  "query": "Counter-Strike 2",
  "limit": 10
}
```

**Response:**
```typescript
{
  "results": [
    {
      "igdb_id": 131800,
      "name": "Counter-Strike 2",
      "cover_url": "https://images.igdb.com/...",
      "genres": ["Shooter", "Tactical"],
      "developer": "Valve",
      "release_year": 2023,
      "platforms": ["PC", "Linux"],
      "rating": 85.5
    }
  ]
}
```

### 2. `igdb-game-details`
Fetch full details for a specific game.

**Request:**
```typescript
POST /functions/v1/igdb-game-details
{
  "igdb_id": 131800
}
```

**Response:**
```typescript
{
  "igdb_id": 131800,
  "name": "Counter-Strike 2",
  "slug": "counter-strike-2",
  "description": "...",
  "cover_url": "https://...",
  "screenshots": ["https://...", "..."],
  "genres": ["Shooter", "Tactical"],
  "developer": "Valve",
  "publisher": "Valve",
  "platforms": ["PC", "Linux"],
  "release_date": "2023-09-27",
  "rating": 85.5,
  "rating_count": 1250,
  "alternative_names": ["CS2", "CSGO 2"],
  "websites": [
    { "type": "official", "url": "https://..." },
    { "type": "steam", "url": "https://..." }
  ]
}
```

### 3. `igdb-import-game`
Import a game from IGDB into our database.

**Request:**
```typescript
POST /functions/v1/igdb-import-game
{
  "igdb_id": 131800
}
```

**Response:**
```typescript
{
  "game_id": "uuid-here",
  "created": true,  // or false if already existed
  "game": { ... }
}
```

### 4. `igdb-sync-metadata`
Background job to refresh stale IGDB data.

**Trigger:** Scheduled (daily/weekly via pg_cron or external)

**Logic:**
1. Find games where `igdb_updated_at` is older than 30 days
2. Batch fetch updated metadata from IGDB
3. Update local records

---

## Implementation Phases

### Phase 1: Core Infrastructure (Priority: High)
1. **Set up Twitch Developer credentials**
   - Create Twitch Developer application
   - Store Client ID/Secret in Supabase secrets

2. **Create `igdb-search` Edge Function**
   - Implement OAuth token management (with caching)
   - Build Apicalypse query builder
   - Add response caching (1 hour TTL)

3. **Create `igdb-import-game` Edge Function**
   - Fetch full game details
   - Insert/update in `games` table
   - Store alternative names

4. **Database migration**
   - Add new columns to `games` table
   - Create `igdb_alternative_names` table

### Phase 2: Web Integration (Priority: High)
1. **Game search UI**
   - Add IGDB search when creating custom game mapping
   - Show IGDB results with cover previews
   - One-click import from search results

2. **Game details enrichment**
   - Display additional metadata on game pages
   - Show screenshots gallery
   - Link to external sites

3. **Admin panel** (if applicable)
   - Bulk import popular games
   - Review and approve process signatures with IGDB linking

### Phase 3: Desktop Integration (Priority: Medium)
1. **Enhanced game matcher**
   - Use alternative names from IGDB for fuzzy matching
   - Suggest IGDB matches for unknown processes

2. **Local IGDB cache**
   - Cache game metadata in SQLite
   - Reduce API calls for repeated lookups

3. **Custom mapping flow**
   - When user maps unknown process, search IGDB
   - Auto-populate game details from selection

### Phase 4: Background Sync (Priority: Low)
1. **Scheduled metadata refresh**
   - Daily job to update stale records
   - Fetch new cover art if changed

2. **Popular games seeding**
   - Pre-populate database with top 1000 games
   - Include common process signatures

---

## API Token Management

### Token Caching Strategy
```
┌─────────────────────────────────────────────────────────┐
│                    Token Flow                           │
├─────────────────────────────────────────────────────────┤
│  1. Check if token exists in cache (KV or memory)       │
│  2. If exists and not expired → use it                  │
│  3. If missing or expired → fetch new token             │
│  4. Store new token with expiry (TTL: token_expires_in) │
│  5. Use token for IGDB request                          │
└─────────────────────────────────────────────────────────┘
```

### Storage Options
1. **Supabase Edge Function Memory** - Simple but lost on cold start
2. **Supabase Database Table** - Persistent, shared across instances
3. **Environment Variable Refresh** - Manual, not recommended

**Recommendation:** Store token in a `system_config` table:
```sql
CREATE TABLE system_config (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz,
  updated_at timestamptz default now()
);

-- Usage:
INSERT INTO system_config (key, value, expires_at)
VALUES ('igdb_token', '{"access_token": "..."}', now() + interval '30 days')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at;
```

---

## Rate Limiting Strategy

### Request Budget
- **Limit**: 4 requests/second
- **Approach**: Queue + throttle at edge function level

### Caching Layers
1. **Edge Function Response Cache**: 1 hour for search results
2. **Database Cache**: Permanent storage after import
3. **Desktop SQLite Cache**: Local copy of synced games

### Batching
For bulk operations (e.g., popular games import):
```typescript
// Process in batches of 10 with 3-second delays
for (const batch of chunks(gameIds, 10)) {
  await Promise.all(batch.map(fetchGame));
  await sleep(3000);  // Stay under 4 req/s
}
```

---

## Security Considerations

1. **Credentials Storage**
   - Store Twitch Client ID/Secret in Supabase Secrets (not code)
   - Never expose credentials to frontend

2. **Edge Function Auth**
   - Require valid Supabase JWT for all IGDB endpoints
   - Rate limit per user to prevent abuse

3. **Input Validation**
   - Sanitize search queries
   - Validate IGDB IDs are integers
   - Limit response sizes

---

## Metrics & Monitoring

### Track These Metrics
- IGDB API call count (daily/monthly)
- Cache hit ratio
- Average response time
- Import success/failure rate
- Token refresh events

### Alerting
- Alert if approaching rate limits
- Alert on repeated auth failures (token issues)
- Alert on import failures

---

## Rollout Plan

### Week 1-2: Foundation
- [ ] Create Twitch Developer app
- [ ] Implement `igdb-search` edge function
- [ ] Add database migration for new columns
- [ ] Manual testing with Postman/curl

### Week 3-4: Web Integration
- [ ] Add IGDB search to game mapping UI
- [ ] Implement `igdb-import-game` function
- [ ] Update game detail pages with new metadata
- [ ] QA and bug fixes

### Week 5-6: Desktop Integration
- [ ] Update desktop client to use IGDB-linked games
- [ ] Implement local caching in SQLite
- [ ] Add IGDB search to custom mapping flow
- [ ] Cross-platform testing

### Week 7+: Polish & Background Jobs
- [ ] Implement scheduled metadata refresh
- [ ] Seed popular games
- [ ] Performance optimization
- [ ] Documentation

---

## Open Questions

1. **Cover Image Hosting**
   - Use IGDB URLs directly? (dependency on their CDN)
   - Mirror to our own storage? (cost + complexity)

2. **Process Signature Matching**
   - Does IGDB provide executable names?
   - Need to build our own mapping regardless?

3. **Rate Limit Concerns**
   - Will 4 req/s be enough at scale?
   - Consider Twitch partnership for higher limits?

4. **Data Freshness**
   - How often to refresh game metadata?
   - Handle games that are removed from IGDB?

---

## Detailed Flow Diagrams

### 1. Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         IGDB AUTH FLOW                                  │
└─────────────────────────────────────────────────────────────────────────┘

  SETUP (One-time):
  ┌──────────────────┐
  │ Twitch Developer │  1. Create app at dev.twitch.tv
  │     Console      │  2. Get Client ID + Client Secret
  └────────┬─────────┘  3. Store in Supabase Secrets
           │
           ▼
  ┌──────────────────┐
  │ Supabase Secrets │  TWITCH_CLIENT_ID=abc123
  │                  │  TWITCH_CLIENT_SECRET=xyz789
  └──────────────────┘

  RUNTIME (Every API call):
  ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
  │  Edge Function   │────▶│  system_config  │────▶│ Token valid? │
  │  (igdb-search)   │     │     table       │     └──────┬───────┘
  └──────────────────┘     └─────────────────┘            │
                                                    ┌─────┴─────┐
                                                   YES          NO
                                                    │            │
                                              ┌─────▼─────┐ ┌────▼────────────┐
                                              │ Use token │ │ Fetch new token │
                                              └───────────┘ │ from Twitch     │
                                                            └────────┬────────┘
                                                                     │
                                              ┌──────────────────────▼──────────────────┐
                                              │ POST https://id.twitch.tv/oauth2/token  │
                                              │ Body: client_id, client_secret,         │
                                              │       grant_type=client_credentials     │
                                              └──────────────────────┬──────────────────┘
                                                                     │
                                              ┌──────────────────────▼──────────────────┐
                                              │ Response: { access_token, expires_in }  │
                                              │ Store in system_config with expiry      │
                                              └─────────────────────────────────────────┘
```

**Why this matters:** IGDB is owned by Twitch. You can't call IGDB directly - you need a valid OAuth token from Twitch first. Tokens last ~60 days, so we cache them in the database to avoid fetching a new one on every request.

---

### 2. Game Search Flow (Web Dashboard)

**Scenario:** User wants to add a custom game mapping and searches for "Elden Ring"

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      GAME SEARCH FLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

  USER ACTION:
  ┌─────────────────────────────────────────────────────────────┐
  │  Web Dashboard - Custom Game Mapping Dialog                 │
  │  ┌─────────────────────────────────────────────────────┐   │
  │  │ Search IGDB: [Elden Ring____________] [🔍 Search]   │   │
  │  └─────────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────┘
                              │
                              │ 1. User types "Elden Ring", clicks Search
                              ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Next.js Frontend                                           │
  │  POST /functions/v1/igdb-search                             │
  │  Headers: { Authorization: Bearer <supabase_jwt> }          │
  │  Body: { "query": "Elden Ring", "limit": 10 }               │
  └─────────────────────────────────────────────────────────────┘
                              │
                              │ 2. Request hits Supabase Edge Function
                              ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Edge Function: igdb-search                                 │
  │                                                             │
  │  a) Validate Supabase JWT (user must be logged in)          │
  │  b) Get/refresh IGDB token (see Auth Flow above)            │
  │  c) Build Apicalypse query:                                 │
  │     ┌─────────────────────────────────────────────────┐     │
  │     │ fields name, slug, cover.url, genres.name,      │     │
  │     │        involved_companies.company.name,         │     │
  │     │        first_release_date;                      │     │
  │     │ search "Elden Ring";                            │     │
  │     │ where category = 0;  // Main games only         │     │
  │     │ limit 10;                                       │     │
  │     └─────────────────────────────────────────────────┘     │
  │  d) Call IGDB API                                           │
  └─────────────────────────────────────────────────────────────┘
                              │
                              │ 3. IGDB API call
                              ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  IGDB API: POST https://api.igdb.com/v4/games               │
  │  Headers: {                                                 │
  │    Client-ID: <twitch_client_id>,                           │
  │    Authorization: Bearer <igdb_token>                       │
  │  }                                                          │
  │  Body: <apicalypse_query>                                   │
  └─────────────────────────────────────────────────────────────┘
                              │
                              │ 4. IGDB returns raw data
                              ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  IGDB Response (raw):                                       │
  │  [                                                          │
  │    {                                                        │
  │      "id": 119133,                                          │
  │      "name": "Elden Ring",                                  │
  │      "slug": "elden-ring",                                  │
  │      "cover": { "url": "//images.igdb.com/t_thumb/xyz.jpg" }│
  │      "genres": [{ "name": "RPG" }, { "name": "Adventure" }],│
  │      "involved_companies": [                                │
  │        { "company": { "name": "FromSoftware" }, ...}        │
  │      ],                                                     │
  │      "first_release_date": 1645747200                       │
  │    },                                                       │
  │    ...more results                                          │
  │  ]                                                          │
  └─────────────────────────────────────────────────────────────┘
                              │
                              │ 5. Edge function transforms & returns
                              ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Edge Function Response (cleaned):                          │
  │  {                                                          │
  │    "results": [                                             │
  │      {                                                      │
  │        "igdb_id": 119133,                                   │
  │        "name": "Elden Ring",                                │
  │        "slug": "elden-ring",                                │
  │        "cover_url": "https://images.igdb.com/t_cover_big/..."│
  │        "genres": ["RPG", "Adventure"],                      │
  │        "developer": "FromSoftware",                         │
  │        "release_year": 2022                                 │
  │      }                                                      │
  │    ]                                                        │
  │  }                                                          │
  └─────────────────────────────────────────────────────────────┘
                              │
                              │ 6. Display results to user
                              ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Web Dashboard - Search Results                             │
  │  ┌─────────────────────────────────────────────────────┐   │
  │  │ 🎮 Elden Ring                          [Import]     │   │
  │  │    FromSoftware • 2022 • RPG, Adventure             │   │
  │  ├─────────────────────────────────────────────────────┤   │
  │  │ 🎮 Elden Ring: Shadow of the Erdtree   [Import]     │   │
  │  │    FromSoftware • 2024 • RPG, Adventure             │   │
  │  └─────────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────┘
```

---

### 3. Game Import Flow

**Scenario:** User clicks "Import" on Elden Ring from search results

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      GAME IMPORT FLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │ User clicks  │
  │  [Import]    │
  └──────┬───────┘
         │
         │ 1. POST /functions/v1/igdb-import-game
         │    Body: { "igdb_id": 119133 }
         ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Edge Function: igdb-import-game                            │
  │                                                             │
  │  Step A: Check if game already exists                       │
  │  ┌─────────────────────────────────────────────────────┐   │
  │  │ SELECT * FROM games WHERE igdb_id = 119133          │   │
  │  └─────────────────────────────────────────────────────┘   │
  │         │                                                   │
  │    ┌────┴────┐                                              │
  │   EXISTS   NOT EXISTS                                       │
  │    │          │                                             │
  │    │          ▼                                             │
  │    │   Step B: Fetch full details from IGDB                 │
  │    │   ┌─────────────────────────────────────────────┐     │
  │    │   │ fields name, slug, summary, cover.*,        │     │
  │    │   │   genres.name, platforms.name,              │     │
  │    │   │   involved_companies.company.name,          │     │
  │    │   │   involved_companies.developer,             │     │
  │    │   │   involved_companies.publisher,             │     │
  │    │   │   screenshots.url, artworks.url,            │     │
  │    │   │   first_release_date, total_rating,         │     │
  │    │   │   total_rating_count, url,                  │     │
  │    │   │   alternative_names.name;                   │     │
  │    │   │ where id = 119133;                          │     │
  │    │   └─────────────────────────────────────────────┘     │
  │    │          │                                             │
  │    │          ▼                                             │
  │    │   Step C: Transform IGDB data → our schema             │
  │    │   ┌─────────────────────────────────────────────┐     │
  │    │   │ {                                           │     │
  │    │   │   igdb_id: 119133,                          │     │
  │    │   │   name: "Elden Ring",                       │     │
  │    │   │   slug: "elden-ring",                       │     │
  │    │   │   description: "...",                       │     │
  │    │   │   cover_url: "https://...",                 │     │
  │    │   │   genres: ["RPG", "Adventure"],             │     │
  │    │   │   developer: "FromSoftware",                │     │
  │    │   │   publisher: "Bandai Namco",                │     │
  │    │   │   platforms: ["PC", "PlayStation 5", ...],  │     │
  │    │   │   release_year: 2022,                       │     │
  │    │   │   rating: 92.5,                             │     │
  │    │   │   metadata_source: "igdb",                  │     │
  │    │   │   igdb_updated_at: now()                    │     │
  │    │   │ }                                           │     │
  │    │   └─────────────────────────────────────────────┘     │
  │    │          │                                             │
  │    │          ▼                                             │
  │    │   Step D: Insert into database                         │
  │    │   ┌─────────────────────────────────────────────┐     │
  │    │   │ INSERT INTO games (...) VALUES (...)        │     │
  │    │   │ RETURNING id                                │     │
  │    │   └─────────────────────────────────────────────┘     │
  │    │          │                                             │
  │    │          ▼                                             │
  │    │   Step E: Store alternative names (for matching)       │
  │    │   ┌─────────────────────────────────────────────┐     │
  │    │   │ INSERT INTO igdb_alternative_names          │     │
  │    │   │ (game_id, igdb_id, name, name_type)         │     │
  │    │   │ VALUES                                      │     │
  │    │   │   (uuid, 119133, 'Elden Ring', 'main'),     │     │
  │    │   │   (uuid, 119133, 'ER', 'abbreviation'),     │     │
  │    │   │   ...                                       │     │
  │    │   └─────────────────────────────────────────────┘     │
  │    │          │                                             │
  │    ▼          ▼                                             │
  │  Return existing    Return new game                         │
  │  game_id            game_id                                 │
  └─────────────────────────────────────────────────────────────┘
         │
         │ 2. Response: { game_id: "uuid", created: true }
         ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Web Dashboard                                              │
  │  - Show success message                                     │
  │  - Now user can link process_name → this game_id            │
  │  - Game appears in library with full metadata               │
  └─────────────────────────────────────────────────────────────┘
```

---

### 4. Desktop Process Matching Flow (Enhanced with IGDB)

**Scenario:** Desktop agent detects `eldenring.exe` running

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 DESKTOP PROCESS MATCHING FLOW                           │
└─────────────────────────────────────────────────────────────────────────┘

  CURRENT FLOW (without IGDB):
  ┌─────────────────────────────────────────────────────────────┐
  │  Process Scanner detects: eldenring.exe                     │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Game Matcher: Check local SQLite cache                     │
  │  ┌─────────────────────────────────────────────────────┐   │
  │  │ SELECT * FROM signatures                            │   │
  │  │ WHERE process_name = 'eldenring.exe'                │   │
  │  └─────────────────────────────────────────────────────┘   │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                   FOUND           NOT FOUND
                    │                  │
                    ▼                  ▼
             Start tracking      Show "Unknown process"
             game session        in tray menu
                                      │
                                      ▼
                              User must manually
                              map to a game


  ENHANCED FLOW (with IGDB):
  ┌─────────────────────────────────────────────────────────────┐
  │  Process Scanner detects: eldenring.exe                     │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Game Matcher: Check local SQLite cache                     │
  │  ┌─────────────────────────────────────────────────────┐   │
  │  │ SELECT * FROM signatures                            │   │
  │  │ WHERE process_name = 'eldenring.exe'                │   │
  │  └─────────────────────────────────────────────────────┘   │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                   FOUND           NOT FOUND
                    │                  │
                    ▼                  ▼
             Start tracking     ┌─────────────────────────────────┐
             game session       │  NEW: Fuzzy match against       │
                                │  alternative names cache        │
                                │  ┌─────────────────────────┐   │
                                │  │ SELECT * FROM alt_names │   │
                                │  │ WHERE name ILIKE        │   │
                                │  │   '%elden%ring%'        │   │
                                │  │ OR name ILIKE           │   │
                                │  │   '%eldenring%'         │   │
                                │  └─────────────────────────┘   │
                                └──────────────┬──────────────────┘
                                               │
                                      ┌────────┴────────┐
                                   MATCH             NO MATCH
                                     │                   │
                                     ▼                   ▼
                              ┌─────────────┐    ┌─────────────────┐
                              │ Suggest     │    │ Search IGDB     │
                              │ "Elden Ring"│    │ via Edge Fn     │
                              │ to user     │    │ (if online)     │
                              └──────┬──────┘    └────────┬────────┘
                                     │                    │
                                     ▼                    ▼
                              ┌─────────────────────────────────────┐
                              │  Tray Notification:                 │
                              │  "Detected: eldenring.exe"          │
                              │  ┌───────────────────────────────┐  │
                              │  │ Did you mean?                 │  │
                              │  │ ○ Elden Ring (IGDB match)     │  │
                              │  │ ○ Search for different game   │  │
                              │  │ ○ Ignore this process         │  │
                              │  └───────────────────────────────┘  │
                              └─────────────────────────────────────┘
                                     │
                                     │ User confirms "Elden Ring"
                                     ▼
                              ┌─────────────────────────────────────┐
                              │  1. Import game from IGDB (if new)  │
                              │  2. Create process_signature:       │
                              │     eldenring.exe → Elden Ring      │
                              │  3. Start tracking session          │
                              │  4. Sync signature to cloud         │
                              └─────────────────────────────────────┘
```

---

### 5. Background Sync Flow

**Scenario:** Keep game metadata fresh and sync between devices

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND SYNC FLOWS                                │
└─────────────────────────────────────────────────────────────────────────┘

  A) SIGNATURE SYNC (Desktop ↔ Cloud) - Already exists, enhanced
  ┌─────────────────────────────────────────────────────────────┐
  │  Desktop App Startup / Every 24 hours                       │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  GET /functions/v1/game-signatures                          │
  │                                                             │
  │  Response now includes IGDB-enriched data:                  │
  │  {                                                          │
  │    "signatures": [                                          │
  │      {                                                      │
  │        "process_name": "eldenring.exe",                     │
  │        "game_id": "uuid",                                   │
  │        "game_name": "Elden Ring",                           │
  │        "cover_url": "https://...",                          │
  │        "igdb_id": 119133,           ← NEW                   │
  │        "alternative_names": [...]    ← NEW                  │
  │      }                                                      │
  │    ]                                                        │
  │  }                                                          │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Store in local SQLite:                                     │
  │  - signatures table (process → game mapping)                │
  │  - games_cache table (game metadata + covers)               │
  │  - alternative_names table (for fuzzy matching)             │
  └─────────────────────────────────────────────────────────────┘


  B) METADATA REFRESH (Cloud → IGDB) - Scheduled job
  ┌─────────────────────────────────────────────────────────────┐
  │  Scheduled: Daily at 3 AM (via pg_cron or external cron)    │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Edge Function: igdb-sync-metadata                          │
  │                                                             │
  │  Step 1: Find stale records                                 │
  │  ┌─────────────────────────────────────────────────────┐   │
  │  │ SELECT igdb_id FROM games                           │   │
  │  │ WHERE igdb_id IS NOT NULL                           │   │
  │  │ AND (igdb_updated_at IS NULL                        │   │
  │  │      OR igdb_updated_at < now() - interval '30 d')  │   │
  │  │ LIMIT 100                                           │   │
  │  └─────────────────────────────────────────────────────┘   │
  │                                                             │
  │  Step 2: Batch fetch from IGDB (respecting rate limits)     │
  │  ┌─────────────────────────────────────────────────────┐   │
  │  │ for each batch of 10 igdb_ids:                      │   │
  │  │   fetch updated metadata                            │   │
  │  │   wait 3 seconds (stay under 4 req/s)               │   │
  │  └─────────────────────────────────────────────────────┘   │
  │                                                             │
  │  Step 3: Update database                                    │
  │  ┌─────────────────────────────────────────────────────┐   │
  │  │ UPDATE games SET                                    │   │
  │  │   cover_url = new_cover,                            │   │
  │  │   rating = new_rating,                              │   │
  │  │   igdb_updated_at = now()                           │   │
  │  │ WHERE igdb_id = ...                                 │   │
  │  └─────────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────┘
```

---

### 6. Rate Limiting & Caching Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   RATE LIMITING & CACHING                               │
└─────────────────────────────────────────────────────────────────────────┘

  IGDB LIMIT: 4 requests/second

  CACHING LAYERS:
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │   Layer 1: Edge Function Memory (per-instance)              │
  │   ┌─────────────────────────────────────────────────┐      │
  │   │ TTL: Duration of function execution             │      │
  │   │ Use: Dedupe within single request batch         │      │
  │   └─────────────────────────────────────────────────┘      │
  │                     │                                       │
  │                     ▼                                       │
  │   Layer 2: PostgreSQL (persistent)                          │
  │   ┌─────────────────────────────────────────────────┐      │
  │   │ TTL: Permanent (refresh via background job)     │      │
  │   │ Use: Primary source of truth after import       │      │
  │   │ Tables: games, igdb_alternative_names           │      │
  │   └─────────────────────────────────────────────────┘      │
  │                     │                                       │
  │                     ▼                                       │
  │   Layer 3: Desktop SQLite (local)                           │
  │   ┌─────────────────────────────────────────────────┐      │
  │   │ TTL: Until next signature sync (24 hours)       │      │
  │   │ Use: Offline support, fast local lookups        │      │
  │   │ Tables: signatures, games_cache, alt_names      │      │
  │   └─────────────────────────────────────────────────┘      │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

  REQUEST FLOW WITH CACHING:
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │   User searches "Elden Ring"                                │
  │         │                                                   │
  │         ▼                                                   │
  │   ┌─────────────┐  HIT   ┌──────────────────────────────┐  │
  │   │ Check if    │───────▶│ Return cached results        │  │
  │   │ recently    │        │ (skip IGDB call)             │  │
  │   │ searched    │        └──────────────────────────────┘  │
  │   └─────────────┘                                          │
  │         │ MISS                                              │
  │         ▼                                                   │
  │   ┌─────────────┐        ┌──────────────────────────────┐  │
  │   │ Check rate  │  OVER  │ Return 429 Too Many Requests │  │
  │   │ limit       │───────▶│ "Please wait and try again"  │  │
  │   │ counter     │        └──────────────────────────────┘  │
  │   └─────────────┘                                          │
  │         │ OK                                                │
  │         ▼                                                   │
  │   ┌─────────────────────────────────────────────────────┐  │
  │   │ Call IGDB API                                       │  │
  │   │ Increment rate counter                              │  │
  │   │ Cache results                                       │  │
  │   │ Return to user                                      │  │
  │   └─────────────────────────────────────────────────────┘  │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

---

### 7. Complete User Journey Example

```
┌─────────────────────────────────────────────────────────────────────────┐
│              COMPLETE USER JOURNEY EXAMPLE                              │
└─────────────────────────────────────────────────────────────────────────┘

  1. USER LAUNCHES GAME
     └─▶ Desktop detects "eldenring.exe"
     └─▶ No signature found locally
     └─▶ Fuzzy match finds "Elden Ring" in alt_names cache
     └─▶ User confirms via tray notification

  2. GAME IMPORTED FROM IGDB
     └─▶ Desktop calls igdb-import-game edge function
     └─▶ Full metadata fetched from IGDB
     └─▶ Game stored in PostgreSQL with cover, description, etc.
     └─▶ Alternative names stored for future matching

  3. SIGNATURE CREATED
     └─▶ "eldenring.exe" → "Elden Ring" mapping saved
     └─▶ Synced to cloud (process_signatures table)
     └─▶ Other users can now auto-detect this game

  4. SESSION TRACKED
     └─▶ Desktop tracks play time as usual
     └─▶ Session synced to cloud on game exit

  5. WEB DASHBOARD SHOWS RICH DATA
     └─▶ User visits dashboard
     └─▶ Elden Ring shows with:
         - High-quality cover art from IGDB
         - Description, genres, platforms
         - Screenshots gallery
         - Links to Steam/official site
         - Play time statistics

  6. NEXT DAY: BACKGROUND REFRESH
     └─▶ Scheduled job checks for stale metadata
     └─▶ If Elden Ring data is >30 days old, refresh
     └─▶ New screenshots or rating changes pulled in
```

This flow ensures:
- **Fast lookups** via multi-layer caching
- **Offline support** via local SQLite
- **Community benefit** via shared process signatures
- **Fresh data** via background sync
- **Rate limit compliance** via throttling and caching

---

## References

- [IGDB API Documentation](https://api-docs.igdb.com/)
- [Twitch Developer Portal](https://dev.twitch.tv/console)
- [Apicalypse Query Language](https://apicalypse.io/)
- [IGDB Image URLs](https://api-docs.igdb.com/#images)
