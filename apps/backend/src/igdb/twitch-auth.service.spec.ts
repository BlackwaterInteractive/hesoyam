import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getLoggerToken } from 'nestjs-pino';
import { of, throwError } from 'rxjs';
import { TwitchAuthService } from './twitch-auth.service';

/**
 * Covers token caching, the 60-second pre-expiry refresh buffer, and refresh
 * on stale. The known concurrent-refresh race (#94) is intentionally NOT
 * covered — the service has no in-flight coalescing yet, so a "concurrent
 * callers share one refresh" test would only pin the buggy behavior. Add it
 * alongside the fix.
 */
describe('TwitchAuthService.getAccessToken', () => {
  let service: TwitchAuthService;
  let httpPost: jest.Mock;

  const noopLogger = () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
  });

  const buildService = async (): Promise<TwitchAuthService> => {
    httpPost = jest.fn();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TwitchAuthService,
        { provide: HttpService, useValue: { post: httpPost } },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('fake-cred'),
          },
        },
        {
          provide: getLoggerToken(TwitchAuthService.name),
          useValue: noopLogger(),
        },
      ],
    }).compile();
    return moduleRef.get(TwitchAuthService);
  };

  const tokenResponse = (token: string, expiresInSec: number) =>
    of({ data: { access_token: token, expires_in: expiresInSec } });

  beforeEach(async () => {
    service = await buildService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('first call hits Twitch and returns the token', async () => {
    httpPost.mockReturnValue(tokenResponse('tok-1', 3600));

    const token = await service.getAccessToken();

    expect(token).toBe('tok-1');
    expect(httpPost).toHaveBeenCalledTimes(1);
    expect(httpPost).toHaveBeenCalledWith(
      'https://id.twitch.tv/oauth2/token',
      null,
      {
        params: {
          client_id: 'fake-cred',
          client_secret: 'fake-cred',
          grant_type: 'client_credentials',
        },
      },
    );
  });

  it('second call within validity window returns the cached token', async () => {
    httpPost.mockReturnValue(tokenResponse('tok-1', 3600));

    await service.getAccessToken();
    const second = await service.getAccessToken();

    expect(second).toBe('tok-1');
    expect(httpPost).toHaveBeenCalledTimes(1);
  });

  it('refreshes when within the 60-second pre-expiry buffer', async () => {
    const T0 = 1_767_225_600_000; // 2026-01-01T00:00:00Z
    jest.useFakeTimers();
    jest.setSystemTime(T0);

    httpPost
      .mockReturnValueOnce(tokenResponse('tok-1', 120)) // expires at T+120s
      .mockReturnValueOnce(tokenResponse('tok-2', 120));

    const first = await service.getAccessToken();
    expect(first).toBe('tok-1');

    // T+50s — still well outside the 60s buffer (buffer kicks in at T+60s)
    jest.setSystemTime(T0 + 50_000);
    expect(await service.getAccessToken()).toBe('tok-1');
    expect(httpPost).toHaveBeenCalledTimes(1);

    // T+70s — inside the 60s buffer (expiry at T+120s, refresh threshold T+60s)
    jest.setSystemTime(T0 + 70_000);
    expect(await service.getAccessToken()).toBe('tok-2');
    expect(httpPost).toHaveBeenCalledTimes(2);
  });

  it('refreshes when the token is fully expired', async () => {
    const T0 = 1_767_225_600_000; // 2026-01-01T00:00:00Z
    jest.useFakeTimers();
    jest.setSystemTime(T0);

    httpPost
      .mockReturnValueOnce(tokenResponse('tok-1', 60))
      .mockReturnValueOnce(tokenResponse('tok-2', 60));

    expect(await service.getAccessToken()).toBe('tok-1');

    // T+90s — well past expiry
    jest.setSystemTime(T0 + 90_000);
    expect(await service.getAccessToken()).toBe('tok-2');
    expect(httpPost).toHaveBeenCalledTimes(2);
  });

  it('propagates errors from Twitch (does not swallow)', async () => {
    httpPost.mockReturnValue(
      throwError(() => new Error('Twitch unreachable')),
    );

    await expect(service.getAccessToken()).rejects.toThrow(
      'Twitch unreachable',
    );
  });
});
