import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuditService } from '../audit/audit.service';
import { ApiException } from '../common/api-exception';
import type { AuthContext, AuthenticatedRequest } from './auth-context';
import { REQUIRED_PERMISSIONS_KEY } from '../authorization/require-permission.decorator';
import { IS_PUBLIC_KEY, REQUIRE_VERIFIED_EMAIL_KEY } from './auth.decorators';
import { SessionAuthGuard } from './session-auth.guard';
import type { SessionService } from './session.service';

const TOKEN = 'a'.repeat(43);
const auth = (emailVerified = true, permissions: string[] = []): AuthContext => ({
  sessionId: 's1',
  userId: 'u1',
  organizationId: 'o1',
  email: 'a@b.co',
  emailVerified,
  sessionExpiresAt: new Date(),
  roles: [],
  permissions: new Set(permissions),
  roleIds: new Set(),
  teamIds: new Set(),
  departmentIds: new Set(),
});

function setup(opts: {
  metadata?: Record<string, unknown>;
  authorization?: string;
  result?: AuthContext | null;
}) {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockImplementation((key: unknown) => opts.metadata?.[key as string] ?? undefined);
  const authenticate = jest.fn().mockResolvedValue(opts.result ?? null);
  const record = jest.fn().mockResolvedValue(undefined);
  const guard = new SessionAuthGuard(
    reflector,
    { authenticate } as unknown as SessionService,
    { record } as unknown as AuditService,
  );
  const request = {
    headers: { authorization: opts.authorization },
    method: 'POST',
    route: { path: '/api/v1/things/:id' },
    params: { id: 'x1' },
  } as unknown as AuthenticatedRequest;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard, context, request, authenticate, record };
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error instanceof ApiException ? error.code : 'unexpected';
  }
}

describe('SessionAuthGuard', () => {
  it('lets @Public() routes through without touching sessions', async () => {
    const { guard, context, authenticate } = setup({ metadata: { [IS_PUBLIC_KEY]: true } });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('denies by default when no credentials are sent', async () => {
    const { guard, context } = setup({});
    expect(await codeOf(guard.canActivate(context))).toBe('UNAUTHENTICATED');
  });

  it.each([`Basic ${TOKEN}`, TOKEN, 'Bearer', `Bearer ${TOKEN} extra`, 'Bearer not/valid'])(
    'rejects malformed Authorization header %p',
    async (authorization) => {
      const { guard, context, authenticate } = setup({ authorization });
      expect(await codeOf(guard.canActivate(context))).toBe('UNAUTHENTICATED');
      expect(authenticate).not.toHaveBeenCalled();
    },
  );

  it('rejects tokens the session service does not accept', async () => {
    const { guard, context } = setup({ authorization: `Bearer ${TOKEN}`, result: null });
    expect(await codeOf(guard.canActivate(context))).toBe('UNAUTHENTICATED');
  });

  it('attaches the server-derived auth context on success', async () => {
    const { guard, context, request } = setup({ authorization: `Bearer ${TOKEN}`, result: auth() });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.auth).toMatchObject({ userId: 'u1', organizationId: 'o1' });
  });

  it('blocks unverified users on @RequireVerifiedEmail() routes', async () => {
    const { guard, context } = setup({
      authorization: `Bearer ${TOKEN}`,
      result: auth(false),
      metadata: { [REQUIRE_VERIFIED_EMAIL_KEY]: true },
    });
    expect(await codeOf(guard.canActivate(context))).toBe('EMAIL_NOT_VERIFIED');
  });

  it('allows verified users on @RequireVerifiedEmail() routes', async () => {
    const { guard, context } = setup({
      authorization: `Bearer ${TOKEN}`,
      result: auth(true),
      metadata: { [REQUIRE_VERIFIED_EMAIL_KEY]: true },
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  describe('@RequirePermission()', () => {
    const withPermissions = (held: string[], required: string[]) =>
      setup({
        authorization: `Bearer ${TOKEN}`,
        result: auth(true, held),
        metadata: { [REQUIRED_PERMISSIONS_KEY]: required },
      });

    it('allows a caller holding every required permission', async () => {
      const { guard, context } = withPermissions(['user.read', 'user.create'], ['user.read', 'user.create']);
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('denies with FORBIDDEN when any required permission is missing, and audits it', async () => {
      const { guard, context, record } = withPermissions(['user.read'], ['user.read', 'user.create']);
      expect(await codeOf(guard.canActivate(context))).toBe('FORBIDDEN');
      expect(record).toHaveBeenCalledWith({
        actor: { userId: 'u1', organizationId: 'o1' },
        action: 'ACCESS_DENIED',
        resourceType: 'ENDPOINT',
        result: 'DENIED',
        metadata: {
          reason: 'FORBIDDEN',
          method: 'POST',
          route: '/api/v1/things/:id',
          id: 'x1',
          required: ['user.read', 'user.create'],
        },
      });
    });

    it('does not audit allowed requests or unauthenticated ones', async () => {
      const allowed = withPermissions(['user.read'], ['user.read']);
      await allowed.guard.canActivate(allowed.context);
      const anonymous = setup({ metadata: { [REQUIRED_PERMISSIONS_KEY]: ['user.read'] } });
      await codeOf(anonymous.guard.canActivate(anonymous.context));
      expect(allowed.record).not.toHaveBeenCalled();
      expect(anonymous.record).not.toHaveBeenCalled();
    });

    it('authenticates before authorizing (no session → 401, not 403)', async () => {
      const { guard, context } = setup({ metadata: { [REQUIRED_PERMISSIONS_KEY]: ['user.read'] } });
      expect(await codeOf(guard.canActivate(context))).toBe('UNAUTHENTICATED');
    });
  });
});
