import { loginSchema, registerSchema } from './auth';

const validRegistration = {
  name: 'Ada Lovelace',
  email: 'Ada@Example.com',
  password: 'correct horse battery',
  organizationName: 'Analytical Engines',
};

describe('registerSchema', () => {
  it('accepts a valid registration and normalises the email', () => {
    expect(registerSchema.parse(validRegistration).email).toBe('ada@example.com');
  });

  it.each(['organizationId', 'role', 'status', 'emailVerifiedAt', 'userId'])(
    'rejects client-supplied %s (mass assignment)',
    (key) => {
      expect(registerSchema.safeParse({ ...validRegistration, [key]: 'x' }).success).toBe(false);
    },
  );

  it('enforces the password policy', () => {
    expect(registerSchema.safeParse({ ...validRegistration, password: 'short' }).success).toBe(false);
  });

  it('requires an organization name', () => {
    expect(registerSchema.safeParse({ ...validRegistration, organizationName: ' ' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('does not apply the registration password policy', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(true);
  });

  it('bounds password length to cap hashing cost', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(129) }).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x', organizationId: 'y' }).success).toBe(
      false,
    );
  });
});
