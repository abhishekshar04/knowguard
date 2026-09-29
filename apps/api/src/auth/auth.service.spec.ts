import { hashPassword } from '@knowguard/auth';

import { ApiException } from '../common/api-exception';
import type { PrismaService } from '../common/prisma.service';
import type { RateLimiterService } from '../common/rate-limiter.service';
import type { OrganizationsService } from '../organizations/organizations.service';
import { AuthService } from './auth.service';
import type { SessionService } from './session.service';

jest.mock('@knowguard/auth', () => {
  const actual = jest.requireActual<typeof import('@knowguard/auth')>('@knowguard/auth');
  return { ...actual, verifyPassword: jest.fn(actual.verifyPassword) };
});
const { verifyPassword } = jest.requireMock<{ verifyPassword: jest.Mock }>('@knowguard/auth');

const meta = { ip: '203.0.113.7', userAgent: 'jest' };
const PASSWORD = 'correct horse battery';
let passwordHash: string;

interface StoredUser {
  id: string;
  passwordHash: string | null;
  status: string;
  memberships: Array<{ organizationId: string }>;
}

function setup(user: StoredUser | null) {
  const rateLimiter = {
    consume: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
  };
  const tx = { user: { update: jest.fn() } };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const sessions = {
    issue: jest.fn().mockResolvedValue({ sessionId: 's1', token: 't'.repeat(43), expiresAt: new Date() }),
  };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    sessions as unknown as SessionService,
    {} as OrganizationsService,
    rateLimiter as unknown as RateLimiterService,
  );
  return { service, rateLimiter, sessions };
}

async function failureOf(
  promise: Promise<unknown>,
): Promise<{ code: string; status: number; message: string }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiException) {
      return { code: error.code, status: error.getStatus(), message: error.message };
    }
    throw error;
  }
  throw new Error('expected a failure');
}

const activeUser = (overrides: Partial<StoredUser> = {}): StoredUser => ({
  id: 'u1',
  passwordHash,
  status: 'ACTIVE',
  memberships: [{ organizationId: 'o1' }],
  ...overrides,
});

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});
beforeEach(() => verifyPassword.mockClear());

describe('AuthService.login', () => {
  it('issues a session for valid credentials and clears the attempt counter', async () => {
    const { service, sessions, rateLimiter } = setup(activeUser());
    await service.onModuleInit();
    await expect(service.login({ email: 'a@b.co', password: PASSWORD }, meta)).resolves.toHaveProperty(
      'token',
    );
    expect(sessions.issue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId: 'o1' }),
    );
    expect(rateLimiter.reset).toHaveBeenCalled();
  });

  const failureCases: Array<[string, StoredUser | null, string]> = [
    ['unknown email', null, PASSWORD],
    ['wrong password', activeUser(), 'wrong password!!'],
    ['user without a password (invited/SSO)', activeUser({ passwordHash: null }), PASSWORD],
    ['suspended account', activeUser({ status: 'SUSPENDED' }), PASSWORD],
    ['deactivated account', activeUser({ status: 'DEACTIVATED' }), PASSWORD],
    ['no active membership', activeUser({ memberships: [] }), PASSWORD],
  ];

  it.each(failureCases)('returns the identical generic failure for: %s', async (_label, user, password) => {
    const { service, rateLimiter, sessions } = setup(user);
    await service.onModuleInit();
    const failure = await failureOf(service.login({ email: 'a@b.co', password }, meta));
    expect(failure).toEqual({
      code: 'INVALID_CREDENTIALS',
      status: 401,
      message: 'Invalid email or password.',
    });
    expect(rateLimiter.reset).not.toHaveBeenCalled();
    expect(sessions.issue).not.toHaveBeenCalled();
  });

  it.each(failureCases)(
    'performs exactly one password verification for: %s (timing parity)',
    async (_l, user, password) => {
      const { service } = setup(user);
      await service.onModuleInit();
      await failureOf(service.login({ email: 'a@b.co', password }, meta));
      expect(verifyPassword).toHaveBeenCalledTimes(1);
    },
  );

  it('counts the attempt against IP and email limits BEFORE verifying the password', async () => {
    const { service, rateLimiter } = setup(activeUser());
    await service.onModuleInit();
    const order: string[] = [];
    rateLimiter.consume.mockImplementation(async (key: string) => {
      order.push(key.startsWith('login:ip:') ? 'ip' : 'email');
    });
    verifyPassword.mockImplementationOnce(async () => {
      order.push('verify');
      return true;
    });
    await service.login({ email: 'a@b.co', password: PASSWORD }, meta);
    expect(order).toEqual(['ip', 'email', 'verify']);
  });

  it('stops before touching credentials once the email is locked', async () => {
    const { service, rateLimiter } = setup(activeUser());
    await service.onModuleInit();
    rateLimiter.consume.mockImplementation(async (key: string) => {
      if (key.startsWith('login:email:')) throw new ApiException('RATE_LIMITED', 'x', 429);
    });
    const failure = await failureOf(service.login({ email: 'a@b.co', password: PASSWORD }, meta));
    expect(failure.code).toBe('RATE_LIMITED');
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('never puts the raw email into rate-limit keys', async () => {
    const { service, rateLimiter } = setup(null);
    await service.onModuleInit();
    await failureOf(service.login({ email: 'secret.person@b.co', password: 'x' }, meta));
    const keys = [...rateLimiter.consume.mock.calls, ...rateLimiter.reset.mock.calls].map((call) => call[0]);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(key).not.toContain('secret.person');
  });
});
