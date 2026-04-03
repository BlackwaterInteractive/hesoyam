import { getApiClient, ApiError } from './client.js';
import { logger } from '../utils/logger.js';
import type {
  GameActivity,
  ApiStartSessionResponse,
  CreateSessionResult,
  GameSessionRow,
} from '../types/index.js';

/**
 * Create or reopen a session via the backend API.
 * The API handles game resolution and presence broadcasting internally.
 */
export async function createSession(
  userId: string,
  discordId: string,
  game: GameActivity,
): Promise<CreateSessionResult | null> {
  try {
    const api = getApiClient();
    const response = await api.post<ApiStartSessionResponse>('/sessions/start', {
      userId,
      discordId,
      gameName: game.name,
      applicationId: game.applicationId ?? undefined,
      startedAt: game.startedAt?.toISOString() ?? undefined,
      source: 'discord',
    });

    const { session, resolvedGame, reopened } = response;

    logger.info('[API] Session created', {
      sessionId: session.id,
      gameName: session.game_name,
      reopened,
      hasResolvedGame: !!resolvedGame,
    });

    return {
      session,
      resolvedGame: resolvedGame ?? {
        id: session.game_id,
        name: session.game_name ?? game.name,
        slug: game.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        cover_url: null,
      },
    };
  } catch (err) {
    if (err instanceof ApiError) {
      logger.error('[API] Failed to create session', err, {
        userId,
        gameName: game.name,
        statusCode: err.statusCode,
      });
    } else {
      logger.error('[API] Failed to create session', err as Error, { userId, gameName: game.name });
    }
    return null;
  }
}

/**
 * Close the active session via the backend API.
 * The API handles presence broadcasting internally.
 */
export async function closeSession(
  userId: string,
  discordId: string,
): Promise<boolean> {
  try {
    const api = getApiClient();
    const result = await api.post<GameSessionRow | null>('/sessions/end', {
      userId,
      discordId,
      source: 'discord',
    });

    if (!result) {
      logger.warn('[API] No active session to close', { userId });
      return false;
    }

    logger.info('[API] Session closed', {
      sessionId: result.id,
      gameName: result.game_name,
      durationSecs: result.duration_secs,
    });

    return true;
  } catch (err) {
    logger.error('[API] Failed to close session', err as Error, { userId });
    return false;
  }
}

/**
 * Send a heartbeat to keep the active session alive.
 * Updates updated_at on the session to prevent stale cleanup.
 */
export async function heartbeat(userId: string): Promise<void> {
  try {
    const api = getApiClient();
    await api.post('/sessions/heartbeat', { userId });
  } catch (err) {
    logger.error('[API] Heartbeat failed', err as Error, { userId });
  }
}
