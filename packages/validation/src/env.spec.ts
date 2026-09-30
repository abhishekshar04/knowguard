import { apiEnvSchema, EnvValidationError, parseEnv } from './env';
import { emailSchema, passwordSchema, slugSchema } from './primitives';

const validApiEnv = {
  DATABASE_URL: 'postgresql://user:s3cret@localhost:5432/db',
  REDIS_URL: 'redis://:s3cret@localhost:6379',
  STORAGE_BUCKET: 'knowguard-documents',
  STORAGE_ACCESS_KEY_ID: 'key',
  STORAGE_SECRET_ACCESS_KEY: 'secret',
};

describe('parseEnv', () => {
  it('parses and applies defaults', () => {
    const env = parseEnv(apiEnvSchema, validApiEnv);
    expect(env.API_PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.MAX_UPLOAD_MB).toBe(25);
    expect(env.STORAGE_AUTO_CREATE_BUCKET).toBe(false);
  });

  it('rejects invalid bucket names', () => {
    expect(() => parseEnv(apiEnvSchema, { ...validApiEnv, STORAGE_BUCKET: 'Bad_Bucket' })).toThrow(
      EnvValidationError,
    );
  });

  it('rejects missing required variables', () => {
    expect(() => parseEnv(apiEnvSchema, { ...validApiEnv, DATABASE_URL: undefined })).toThrow(
      EnvValidationError,
    );
  });

  it('never echoes secret values in the error message', () => {
    const leaky = { ...validApiEnv, DATABASE_URL: 'mysql://user:TOP-SECRET@host/db' };
    try {
      parseEnv(apiEnvSchema, leaky);
      throw new Error('expected parseEnv to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as Error).message).toContain('DATABASE_URL');
      expect((error as Error).message).not.toContain('TOP-SECRET');
    }
  });
});

describe('primitives', () => {
  it('normalises email case and whitespace', () => {
    expect(emailSchema.parse('  Alice@Example.COM ')).toBe('alice@example.com');
  });

  it('enforces minimum password length', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('a-long-enough-passphrase').success).toBe(true);
  });

  it('accepts only URL-safe slugs', () => {
    expect(slugSchema.safeParse('acme-corp').success).toBe(true);
    expect(slugSchema.safeParse('Acme Corp').success).toBe(false);
    expect(slugSchema.safeParse('acme--corp').success).toBe(false);
  });
});
