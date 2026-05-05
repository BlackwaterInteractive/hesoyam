// Dry-run bulk seed of 7 hand-picked games covering each catalog edge case.
// Validates the seed pipeline (Discord per-app RPC + IGDB enrichment +
// federation) end-to-end against staging before scaling to a 100-game run.
//
// Resolution chain per game:
//   Tier A: Discord per-app RPC has igdb_id   → igdb.fetchGameData(igdb_id)
//   Tier B: Discord per-app RPC has steam SKU → igdb.findBySteamSku(sku)
//   Tier C: fuzzy igdb.search(name)           → top match (best-effort)
//   None:   row gets metadata_source='discord'; cron fills IGDB later
//
// Usage (from apps/backend; .env.staging is auto-loaded by AppModule when
// NODE_ENV !== 'production'):
//
//   pnpm exec ts-node -r tsconfig-paths/register scripts/seed-games-dry-run.ts
//
// Refuses to run if SUPABASE_URL points at the production project.

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/core/supabase/supabase.service';
import { DiscordAppService, DiscordAppData } from '../src/discord/discord-app.service';
import { IgdbGameData, IgdbService } from '../src/igdb/igdb.service';

const PROD_PROJECT_REF = 'oubdkgdzssmckayxfrjs';

const SAMPLE: Array<{ application_id: string; note: string }> = [
  { application_id: '1314682894106497096', note: 'Delta Force (idempotency, Shape A multi-exe)' },
  { application_id: '1470616226995765409', note: 'Neverness to Everness (idempotency, SDK-only)' },
  { application_id: '787443973538971748',  note: 'Cyberpunk 2077 (Tier A or B → canonical)' },
  { application_id: '356875221078245376',  note: 'Overwatch (Shape B linked_applications)' },
  { application_id: '762434991303950386',  note: 'Genshin Impact (no Steam SKU)' },
  { application_id: '1402418696126992445', note: 'League of Legends (no Steam SKU)' },
  { application_id: '489916817146511371',  note: 'Seasons after Fall (Steam SKU)' },
];

type SeedTier = 'A' | 'B' | 'C' | 'none';

type SeedStatus =
  | 'skipped'
  | 'seeded'
  | 'unknown-app'
  | 'rpc-failed';

interface SeedResult {
  application_id: string;
  status: SeedStatus;
  tier?: SeedTier;
  game_id?: string;
  message: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function resolveIgdb(
  discord: DiscordAppData,
  igdb: IgdbService,
  logger: Logger,
): Promise<{ data: IgdbGameData | null; tier: SeedTier }> {
  // Tier A: Discord per-app RPC has IGDB id directly.
  if (discord.igdb_id != null) {
    try {
      const data = await igdb.fetchGameData(discord.igdb_id);
      return { data, tier: 'A' };
    } catch (err) {
      logger.warn(
        `Tier A failed for ${discord.name} (igdb_id=${discord.igdb_id}): ${(err as Error).message}`,
      );
    }
  }

  // Tier B: Discord per-app RPC has Steam SKU → IGDB external_games.
  if (discord.steam_app_id) {
    try {
      const data = await igdb.findBySteamSku(discord.steam_app_id);
      if (data) return { data, tier: 'B' };
    } catch (err) {
      logger.warn(
        `Tier B failed for ${discord.name} (steam=${discord.steam_app_id}): ${(err as Error).message}`,
      );
    }
  }

  // Tier C: fuzzy name search.
  try {
    const candidates = (await igdb.search(discord.name, 5)) as Array<{ id?: number }>;
    if (candidates && candidates.length > 0 && candidates[0].id) {
      const data = await igdb.fetchGameData(candidates[0].id);
      return { data, tier: 'C' };
    }
  } catch (err) {
    logger.warn(
      `Tier C failed for ${discord.name}: ${(err as Error).message}`,
    );
  }

  return { data: null, tier: 'none' };
}

async function seedOne(
  application_id: string,
  igdb: IgdbService,
  discordApp: DiscordAppService,
  supabase: SupabaseService,
  logger: Logger,
): Promise<SeedResult> {
  const client = supabase.getClient();

  // Idempotency: any prior mapping of this application_id wins.
  const { data: existing } = await client
    .from('game_discord_applications')
    .select('game_id')
    .eq('application_id', application_id)
    .maybeSingle();
  if (existing) {
    return {
      application_id,
      status: 'skipped',
      game_id: existing.game_id,
      message: `already mapped to game ${existing.game_id}`,
    };
  }

  // Source-of-truth Discord data: name, IGDB id, store SKUs, linked apps.
  const discord = await discordApp.fetchAppData(application_id);
  if (!discord) {
    return {
      application_id,
      status: 'unknown-app',
      message: 'Discord per-app RPC returned null (404 or unreachable)',
    };
  }

  const { data: igdbData, tier } = await resolveIgdb(discord, igdb, logger);

  const fallback_artwork = discord.icon
    ? `https://cdn.discordapp.com/app-icons/${discord.id}/${discord.icon}.png`
    : null;

  const slug = `${slugify(discord.name)}-${discord.id}`;

  const game = {
    name:               discord.name,
    slug,
    igdb_id:            igdbData?.igdb_id ?? null,
    cover_url:          igdbData?.cover_url ?? fallback_artwork,
    genres:             igdbData?.genres ?? [],
    developer:          igdbData?.developer ?? null,
    release_year:       igdbData?.release_year ?? null,
    description:        igdbData?.description ?? discord.description,
    publisher:          igdbData?.publisher ?? null,
    platforms:          igdbData?.platforms ?? [],
    screenshots:        igdbData?.screenshots ?? [],
    artwork_url:        igdbData?.artwork_url ?? fallback_artwork,
    igdb_url:           igdbData ? `https://www.igdb.com/games/${igdbData.slug}` : null,
    rating:             igdbData?.rating ?? null,
    rating_count:       igdbData?.rating_count ?? null,
    first_release_date: igdbData?.first_release_date ?? null,
    igdb_updated_at:    igdbData ? new Date().toISOString() : null,
    metadata_source:    igdbData ? 'igdb' : 'discord',
    discord_name:       discord.name,
    discord_aliases:    discord.aliases,
    steam_app_id:       discord.steam_app_id,
    epic_id:            discord.epic_id,
    xbox_app_id:        discord.xbox_app_id,
  };

  const app_ids = [discord.id, ...discord.linked_app_ids];

  const { data: newGameId, error } = await client.rpc('seed_game_with_apps', {
    p_game:    game,
    p_app_ids: app_ids,
  });

  if (error) {
    return {
      application_id,
      status: 'rpc-failed',
      tier,
      message: `RPC failed: ${error.message}`,
    };
  }

  return {
    application_id,
    status: 'seeded',
    tier,
    game_id: newGameId as string,
    message: `${discord.name} via Tier ${tier} → ${app_ids.length} app id(s) → igdb_id=${igdbData?.igdb_id ?? 'null'}`,
  };
}

async function main(): Promise<void> {
  // No `logger:` override — let the AppModule's Pino config emit progress.
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = new Logger('SeedDryRun');
  const config = app.get(ConfigService);
  const igdb = app.get(IgdbService);
  const discordApp = app.get(DiscordAppService);
  const supabase = app.get(SupabaseService);

  const supabaseUrl = config.getOrThrow<string>('SUPABASE_URL');
  if (supabaseUrl.includes(PROD_PROJECT_REF)) {
    logger.error(
      `Refusing to run: SUPABASE_URL points at the production project (${PROD_PROJECT_REF}). ` +
        `Run with .env.staging or set SUPABASE_URL to a staging project.`,
    );
    await app.close();
    process.exit(1);
  }

  logger.log(`Target Supabase: ${supabaseUrl}`);
  logger.log(`Sample size: ${SAMPLE.length} games`);

  const results: SeedResult[] = [];
  for (const { application_id, note } of SAMPLE) {
    logger.log(`\n[${application_id}] ${note}`);
    const result = await seedOne(application_id, igdb, discordApp, supabase, logger);
    const tierLabel = result.tier ? ` (Tier ${result.tier})` : '';
    logger.log(`  → ${result.status}${tierLabel}: ${result.message}`);
    results.push(result);
  }

  logger.log('\n=== Summary ===');
  const counts: Record<SeedStatus, number> = {
    skipped:       0,
    seeded:        0,
    'unknown-app': 0,
    'rpc-failed':  0,
  };
  const tierCounts: Record<SeedTier, number> = { A: 0, B: 0, C: 0, none: 0 };
  for (const r of results) {
    counts[r.status] += 1;
    if (r.tier) tierCounts[r.tier] += 1;
  }
  for (const status of Object.keys(counts) as SeedStatus[]) {
    logger.log(`  ${status}: ${counts[status]}`);
  }
  logger.log(`  tier breakdown — A: ${tierCounts.A}, B: ${tierCounts.B}, C: ${tierCounts.C}, none: ${tierCounts.none}`);

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
