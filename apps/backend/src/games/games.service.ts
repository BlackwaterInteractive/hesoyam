import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../core/supabase/supabase.service';
import { DiscordAppData } from '../discord/discord-app.service';

export interface ResolvedGame {
  id: string;
  name: string;
  slug: string;
  cover_url: string | null;
  igdb_id: number | null;
}

@Injectable()
export class GamesService {
  constructor(
    private supabase: SupabaseService,
    @InjectPinoLogger(GamesService.name) private logger: PinoLogger,
  ) {}

  /**
   * Forward lookup: which game (if any) owns this Discord application id?
   * Single round-trip via the federation table; PK on application_id makes
   * this an index seek.
   */
  async findByApplicationId(applicationId: string): Promise<ResolvedGame | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('game_discord_applications')
      .select('game:games(id, name, slug, cover_url, igdb_id)')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (error) {
      this.logger.warn(
        { error, applicationId },
        'findByApplicationId failed',
      );
      return null;
    }
    // Supabase nests the joined row under the alias `game`. The generated
    // type widens many-to-one joins as arrays; the actual runtime payload
    // is a single object for this query shape (one junction row → one
    // game). Cast through unknown to bridge the gap.
    const game =
      (data as unknown as { game: ResolvedGame | null } | null)?.game ??
      null;
    return game;
  }

  /**
   * Reverse lookup: given a set of Discord application ids, return the
   * canonical game(s) any of them already point to. Used by the resolver
   * to detect "RPC says this new app id is linked to X, Y, Z — does any
   * existing game already own X/Y/Z?" Single round-trip; ANY($1) is
   * indexed via the PK.
   *
   * Returns the application_id → game mapping for every hit (so callers can
   * tell which inputs matched and seed the rest).
   */
  async findByApplicationIds(
    applicationIds: string[],
  ): Promise<{ application_id: string; game: ResolvedGame }[]> {
    if (applicationIds.length === 0) return [];
    const { data, error } = await this.supabase
      .getClient()
      .from('game_discord_applications')
      .select('application_id, game:games(id, name, slug, cover_url, igdb_id)')
      .in('application_id', applicationIds);

    if (error) {
      this.logger.warn(
        { error, applicationIds },
        'findByApplicationIds failed',
      );
      return [];
    }
    // Same many-to-one widening caveat as findByApplicationId: cast
    // through unknown so the runtime shape (one game object per junction
    // row) lines up with the generated type's array widening.
    return (
      (data as unknown as
        | {
            application_id: string;
            game: ResolvedGame | null;
          }[]
        | null) ?? []
    ).filter((r): r is { application_id: string; game: ResolvedGame } =>
      r.game !== null,
    );
  }

  /**
   * Federate a primary Discord application id (and any RPC-linked siblings)
   * onto a game. Idempotent and race-safe via `ON CONFLICT (application_id)
   * DO NOTHING` — concurrent writers attempting to claim the same id will
   * see one winner; losers are silently no-op'd. Caller is responsible for
   * re-resolving if it needs the actual canonical game post-conflict.
   *
   * Concept: Optimistic Concurrency via ON CONFLICT (concepts.md).
   */
  async linkDiscordApplications(
    gameId: string,
    primaryApplicationId: string,
    linkedApplicationIds: string[] = [],
  ): Promise<void> {
    const all = Array.from(
      new Set([primaryApplicationId, ...linkedApplicationIds]),
    );
    const rows = all.map((application_id) => ({
      application_id,
      game_id: gameId,
    }));

    const { error } = await this.supabase
      .getClient()
      .from('game_discord_applications')
      .upsert(rows, {
        onConflict: 'application_id',
        ignoreDuplicates: true,
      });

    if (error) {
      this.logger.warn(
        { error, gameId, applicationIds: all },
        'linkDiscordApplications failed',
      );
    }
  }

  /**
   * Persist Discord-side metadata onto an existing games row. Called after
   * the resolver's Tier 0c lookup yields a Discord application that maps to
   * (or independently identifies) the row we're saving.
   *
   * Only writes columns that have a value in `data`; null/undefined entries
   * are skipped so we never clobber a curated value with a missing one.
   */
  async applyDiscordData(
    gameId: string,
    data: DiscordAppData,
  ): Promise<void> {
    const update: Record<string, unknown> = {};
    if (data.name) update.discord_name = data.name;
    if (data.aliases?.length) update.discord_aliases = data.aliases;
    if (data.steam_app_id) update.steam_app_id = data.steam_app_id;
    if (data.gog_id) update.gog_id = data.gog_id;
    if (data.epic_id) update.epic_id = data.epic_id;
    if (data.xbox_app_id) update.xbox_app_id = data.xbox_app_id;
    if (data.opencritic_id) update.opencritic_id = data.opencritic_id;

    if (Object.keys(update).length === 0) return;

    const { error } = await this.supabase
      .getClient()
      .from('games')
      .update(update)
      .eq('id', gameId);

    if (error) {
      this.logger.warn(
        { error, gameId, fields: Object.keys(update) },
        'Failed to apply Discord-side metadata to games row',
      );
    }
  }

  /**
   * Set discord_name on a row if it isn't already set. Used as a fallback in
   * the resolver when we don't have RPC data — captures the original Discord
   * presence string so admins can see "Discord said X → we matched it to Y"
   * in the games dashboard. Closes #114.
   */
  async setDiscordNameIfMissing(
    gameId: string,
    discordName: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('games')
      .update({ discord_name: discordName })
      .eq('id', gameId)
      .is('discord_name', null);

    if (error) {
      this.logger.warn(
        { error, gameId },
        'Failed to set discord_name fallback',
      );
    }
  }

  async findExact(name: string): Promise<ResolvedGame | null> {
    const { data } = await this.supabase
      .getClient()
      .from('games')
      .select('id, name, slug, cover_url, igdb_id')
      .ilike('name', name)
      .limit(1)
      .single();

    return data ?? null;
  }

  async findFuzzy(name: string): Promise<ResolvedGame | null> {
    const { data } = await this.supabase
      .getClient()
      .rpc('search_games_fuzzy', { search_term: name });

    if (data && data.length > 0) {
      return data[0];
    }

    return null;
  }

  async createMinimal(gameName: string): Promise<ResolvedGame> {
    const slug = gameName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    const { data, error } = await this.supabase
      .getClient()
      .from('games')
      .insert({
        name: gameName,
        slug: `${slug}-${Date.now()}`,
        metadata_source: 'discord',
      })
      .select('id, name, slug, cover_url, igdb_id')
      .single();

    if (error) {
      this.logger.error({ error, gameName }, 'Failed to create minimal game');
      throw error;
    }

    this.logger.info({ gameName, slug: data.slug }, 'Created minimal game record');
    return data;
  }
}
