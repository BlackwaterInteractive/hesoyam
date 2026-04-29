import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtGuard } from './jwt.guard';
import { SupabaseService } from '../../core/supabase/supabase.service';

describe('JwtGuard', () => {
  const buildContext = (headers: Record<string, string | undefined>) => {
    const request: { headers: Record<string, string | undefined>; user?: unknown } =
      { headers };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { ctx, request };
  };

  const buildGuard = (getUser: jest.Mock): JwtGuard => {
    const supabase = {
      getClient: () => ({ auth: { getUser } }),
    } as unknown as SupabaseService;
    return new JwtGuard(supabase);
  };

  it('throws when Authorization header is missing', async () => {
    const guard = buildGuard(jest.fn());
    const { ctx } = buildContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws when Authorization header does not start with "Bearer "', async () => {
    const guard = buildGuard(jest.fn());
    const { ctx } = buildContext({ authorization: 'Basic abcdef' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws when Supabase returns an error', async () => {
    const getUser = jest.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'expired' },
    });
    const guard = buildGuard(getUser);
    const { ctx } = buildContext({ authorization: 'Bearer expired-token' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(getUser).toHaveBeenCalledWith('expired-token');
  });

  it('throws when Supabase returns no user (and no error)', async () => {
    const getUser = jest.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const guard = buildGuard(getUser);
    const { ctx } = buildContext({ authorization: 'Bearer any-token' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('returns true and attaches the user to the request on success', async () => {
    const user = { id: 'user-uuid', email: 'a@b.c' };
    const getUser = jest.fn().mockResolvedValue({ data: { user }, error: null });
    const guard = buildGuard(getUser);
    const { ctx, request } = buildContext({
      authorization: 'Bearer good-token',
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toEqual(user);
    expect(getUser).toHaveBeenCalledWith('good-token');
  });
});
