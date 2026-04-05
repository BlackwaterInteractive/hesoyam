import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../core/supabase/supabase.service';

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

  async findByApplicationId(applicationId: string): Promise<ResolvedGame | null> {
    const { data } = await this.supabase
      .getClient()
      .from('games')
      .select('id, name, slug, cover_url, igdb_id')
      .eq('discord_application_id', applicationId)
      .limit(1)
      .single();

    return data ?? null;
  }

  async setApplicationId(gameId: string, applicationId: string): Promise<void> {
    try {
      await this.supabase
        .getClient()
        .from('games')
        .update({ discord_application_id: applicationId })
        .eq('id', gameId)
        .is('discord_application_id', null);
    } catch (err) {
      // Unique constraint violation — another game already has this applicationId. No-op.
      this.logger.warn({ err, gameId, applicationId }, 'Failed to set applicationId (likely unique conflict)');
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
