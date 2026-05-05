import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../core/supabase/supabase.service';
import { GameResolverService } from '../games/game-resolver.service';
import { PresenceService } from '../presence/presence.service';
import { StartSessionDto } from './dto/start-session.dto';
import { EndSessionDto } from './dto/end-session.dto';
import { HeartbeatSessionDto } from './dto/heartbeat-session.dto';

@Injectable()
export class SessionsService {
  constructor(
    private supabase: SupabaseService,
    private gameResolver: GameResolverService,
    private presence: PresenceService,
    @InjectPinoLogger(SessionsService.name) private logger: PinoLogger,
  ) {}

  async startSession(dto: StartSessionDto) {
    const client = this.supabase.getClient();

    // 1. Resolve the canonical game first. After the federation work, all
    // lifecycle decisions key on `game_id` (the canonical row) rather than
    // the raw Discord `gameName`, so the same game flapping between
    // multiple Discord application ids (launcher → game-proc, companion
    // bot → main, regional variants) no longer triggers session churn.
    // Cache + in-flight coalescing make this cheap on the hot path.
    const resolvedGame = await this.gameResolver.resolve(
      dto.gameName,
      dto.applicationId,
    );

    // 2. Check for existing active session.
    const { data: activeSession } = await client
      .from('game_sessions')
      .select('*')
      .eq('user_id', dto.userId)
      .is('ended_at', null)
      .single();

    // 3. Same canonical game already active — idempotent return.
    if (activeSession && activeSession.game_id === resolvedGame.id) {
      this.logger.info(
        {
          sessionId: activeSession.id,
          gameId: resolvedGame.id,
          gameName: dto.gameName,
        },
        'Session already active for this game, returning existing',
      );
      return { session: activeSession, resolvedGame, reopened: false };
    }

    // 4. Different canonical game already active — game switch. Close old.
    if (activeSession && activeSession.game_id !== resolvedGame.id) {
      await this.endSession({
        userId: dto.userId,
        discordId: dto.discordId,
        source: dto.source,
      });
    }

    // 5. Try reopen — same canonical game, same Discord launch timestamp.
    // Recovers from gateway reconnects where Discord re-emits the original
    // started_at after a brief drop.
    if (dto.startedAt) {
      const { data: lastSession } = await client
        .from('game_sessions')
        .select('*')
        .eq('user_id', dto.userId)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(1)
        .single();

      if (
        lastSession &&
        lastSession.game_id === resolvedGame.id &&
        new Date(dto.startedAt).getTime() === new Date(lastSession.started_at).getTime()
      ) {
        this.logger.info(
          {
            sessionId: lastSession.id,
            gameId: resolvedGame.id,
            gameName: dto.gameName,
          },
          'Reopening session (same launch detected)',
        );

        const { error: reopenError } = await client.rpc(
          'reopen_session_atomic',
          {
            p_session_id: lastSession.id,
            p_user_id: dto.userId,
            p_game_id: lastSession.game_id,
          },
        );

        if (!reopenError) {
          // Re-fetch the session to get the updated row after RPC
          const { data: reopenedSession } = await client
            .from('game_sessions')
            .select('*')
            .eq('id', lastSession.id)
            .single();

          const session = reopenedSession ?? lastSession;

          await this.presence.broadcast(dto.userId, {
            user_id: dto.userId,
            event: 'start',
            game_name: resolvedGame.name,
            game_slug: resolvedGame.slug,
            cover_url: resolvedGame.cover_url,
            started_at: session.started_at,
          });

          return { session, resolvedGame, reopened: true };
        }

        this.logger.warn({ error: reopenError }, 'Failed to reopen session, creating new one');
      }
    }

    // 6. Create new session. `game_name` keeps being stored as audit
    // metadata (the raw Discord presence string) — it's not used for any
    // lifecycle decision after this commit.
    const { data: session, error } = await client
      .from('game_sessions')
      .insert({
        user_id: dto.userId,
        game_id: resolvedGame.id,
        game_name: dto.gameName,
        started_at: dto.startedAt ?? new Date().toISOString(),
        source: dto.source,
      })
      .select()
      .single();

    if (error) {
      this.logger.error({ error, userId: dto.userId }, 'Failed to create session');
      throw error;
    }

    this.logger.info(
      {
        sessionId: session.id,
        gameId: resolvedGame.id,
        gameName: dto.gameName,
        userId: dto.userId,
      },
      'Session created',
    );

    // 7. Broadcast presence
    await this.presence.broadcast(dto.userId, {
      user_id: dto.userId,
      event: 'start',
      game_name: resolvedGame.name,
      game_slug: resolvedGame.slug,
      cover_url: resolvedGame.cover_url,
      started_at: session.started_at,
    });

    return { session, resolvedGame, reopened: false };
  }

  async endSession(dto: EndSessionDto) {
    const client = this.supabase.getClient();

    // Single atomic UPDATE ... RETURNING via RPC
    this.logger.info({ userId: dto.userId, source: dto.source }, 'Closing session via RPC');

    const { data, error } = await client.rpc(
      'close_session_returning',
      {
        p_user_id: dto.userId,
        p_source: dto.source ?? null,
      },
    );

    if (error) {
      this.logger.error({ error, userId: dto.userId }, 'Failed to close session');
      throw error;
    }

    // RPC returns SETOF (array) — take first row
    const closedSession = Array.isArray(data) ? data[0] : data;

    if (!closedSession) {
      this.logger.warn({ userId: dto.userId }, 'No active session to close');
      return null;
    }

    this.logger.info(
      { sessionId: closedSession.id, userId: dto.userId },
      'Session closed',
    );

    // Broadcast end
    await this.presence.broadcast(dto.userId, {
      user_id: dto.userId,
      event: 'end',
      game_name: null,
      game_slug: null,
      cover_url: null,
      started_at: null,
    });

    return closedSession;
  }

  async heartbeat(dto: HeartbeatSessionDto) {
    const { error } = await this.supabase
      .getClient()
      .from('game_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('user_id', dto.userId)
      .is('ended_at', null);

    if (error) {
      this.logger.error({ error, userId: dto.userId }, 'Heartbeat failed');
      throw error;
    }
  }

  @Cron('*/5 * * * *')
  async cleanupStaleSessions() {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('close_stale_sessions');

    if (error) {
      this.logger.error({ error }, 'Stale session cleanup failed');
      return;
    }

    if (data && data > 0) {
      this.logger.info({ closedCount: data }, 'Stale sessions cleaned up');
    }
  }
}
