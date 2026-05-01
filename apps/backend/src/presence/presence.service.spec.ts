import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import {
  PresenceBroadcastPayload,
  PresenceService,
} from './presence.service';
import { SupabaseService } from '../core/supabase/supabase.service';

/**
 * The contract is small but load-bearing: broadcast must publish on the
 * per-user channel and must NEVER throw — sessions code calls broadcast on
 * every start/heartbeat/end, and an unhandled rejection there would crash
 * the session lifecycle. The mobile app's 45s staleness fallback covers a
 * dropped broadcast.
 */
describe('PresenceService.broadcast', () => {
  let service: PresenceService;
  let send: jest.Mock;
  let channel: jest.Mock;

  const noopLogger = () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
  });

  const buildService = async (): Promise<PresenceService> => {
    send = jest.fn();
    channel = jest.fn(() => ({ send }));

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ channel }) },
        },
        {
          provide: getLoggerToken(PresenceService.name),
          useValue: noopLogger(),
        },
      ],
    }).compile();
    return moduleRef.get(PresenceService);
  };

  beforeEach(async () => {
    service = await buildService();
  });

  const samplePayload: PresenceBroadcastPayload = {
    user_id: 'user-1',
    event: 'start',
    game_name: 'Hades',
    game_slug: 'hades',
    cover_url: 'https://example.com/hades.jpg',
    started_at: '2026-04-30T12:00:00Z',
  };

  it('publishes on presence:{user_id} with the full payload', async () => {
    send.mockResolvedValue('ok');

    await service.broadcast('user-1', samplePayload);

    expect(channel).toHaveBeenCalledWith('presence:user-1');
    expect(send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'game_presence',
      payload: samplePayload,
    });
  });

  it('does not throw when the channel send rejects (mobile staleness fallback handles it)', async () => {
    send.mockRejectedValue(new Error('realtime unreachable'));

    await expect(
      service.broadcast('user-1', samplePayload),
    ).resolves.toBeUndefined();
  });

  it('does not throw when channel construction itself throws synchronously', async () => {
    channel.mockImplementation(() => {
      throw new Error('client torn down');
    });

    await expect(
      service.broadcast('user-1', samplePayload),
    ).resolves.toBeUndefined();
  });
});
