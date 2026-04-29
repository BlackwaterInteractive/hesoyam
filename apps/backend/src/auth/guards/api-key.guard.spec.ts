import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  const VALID_KEY = 'super-secret-test-key';

  const buildContext = (
    headers: Record<string, string | undefined>,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as unknown as ExecutionContext;

  const buildGuard = (): ApiKeyGuard => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue(VALID_KEY),
    } as unknown as ConfigService;
    return new ApiKeyGuard(config);
  };

  it('returns true when x-api-key matches the configured key', () => {
    const guard = buildGuard();
    expect(guard.canActivate(buildContext({ 'x-api-key': VALID_KEY }))).toBe(
      true,
    );
  });

  it('throws UnauthorizedException when x-api-key header is missing', () => {
    const guard = buildGuard();
    expect(() => guard.canActivate(buildContext({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when x-api-key value is wrong', () => {
    const guard = buildGuard();
    expect(() =>
      guard.canActivate(buildContext({ 'x-api-key': 'wrong-key' })),
    ).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when x-api-key is an empty string', () => {
    const guard = buildGuard();
    expect(() =>
      guard.canActivate(buildContext({ 'x-api-key': '' })),
    ).toThrow(UnauthorizedException);
  });
});
