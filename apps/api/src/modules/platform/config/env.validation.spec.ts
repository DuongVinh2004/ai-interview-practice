import { validateEnv } from './env.validation';

const productionBase = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:password@db.internal:5432/app',
  CORS_ORIGIN: 'https://app.example.com',
  REDIS_HOST: 'redis.internal',
  REDIS_PASSWORD: 'production-redis-password-32-chars',
  REDIS_TLS: 'true',
  JWT_ACCESS_SECRET: 'access-secret-at-least-16-characters',
  JWT_REFRESH_SECRET: 'refresh-secret-at-least-16-characters',
  MFA_ENCRYPTION_KEY: 'test-mfa-encryption-key-32-chars',
  CERTIFICATE_SECRET: 'test-certificate-secret-32-chars',
  AI_PROVIDER: 'openai',
  OPENAI_API_KEY: 'test-openai-key',
  STORAGE_PROVIDER: 's3',
  AWS_S3_BUCKET: 'production-user-content',
};

describe('validateEnv production mock-provider boundary', () => {
  it.each([
    [{ AI_PROVIDER: 'mock' }, 'AI_PROVIDER=mock'],
    [{ AI_ALLOW_MOCK: 'true' }, 'AI_ALLOW_MOCK=true'],
    [{ ALLOW_MOCK_PROVIDERS: 'true' }, 'ALLOW_MOCK_PROVIDERS=true'],
    [{ STORAGE_PROVIDER: 'mock' }, 'STORAGE_PROVIDER=mock'],
  ])('rejects insecure production configuration %o', (override, expected) => {
    expect(() => validateEnv({ ...productionBase, ...override })).toThrow(expected);
  });

  it('allows mock providers in development without granting production authority', () => {
    expect(
      validateEnv({
        ...productionBase,
        NODE_ENV: 'development',
        AI_PROVIDER: 'mock',
        AI_ALLOW_MOCK: 'true',
        ALLOW_MOCK_PROVIDERS: 'true',
      }),
    ).toMatchObject({
      NODE_ENV: 'development',
      AI_PROVIDER: 'mock',
      AI_ALLOW_MOCK: 'true',
      ALLOW_MOCK_PROVIDERS: 'true',
    });
  });

  it('keeps the auth refresh throttle at its production default unless explicitly overridden', () => {
    expect(validateEnv(productionBase).AUTH_REFRESH_THROTTLE_LIMIT).toBe(60);
    expect(
      validateEnv({ ...productionBase, AUTH_REFRESH_THROTTLE_LIMIT: '1000' })
        .AUTH_REFRESH_THROTTLE_LIMIT,
    ).toBe(1000);
    expect(() => validateEnv({ ...productionBase, AUTH_REFRESH_THROTTLE_LIMIT: '0' })).toThrow(
      'AUTH_REFRESH_THROTTLE_LIMIT',
    );
  });

  it('requires a strong service token for an enabled production metrics exporter', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        METRICS_EXPORTER_ENABLED: 'true',
        METRICS_AUTH_TOKEN: 'short',
      }),
    ).toThrow('METRICS_AUTH_TOKEN');

    expect(() =>
      validateEnv({
        ...productionBase,
        METRICS_EXPORTER_ENABLED: 'true',
        METRICS_AUTH_TOKEN: 'a-production-metrics-token-with-32-plus-characters',
      }),
    ).not.toThrow();
  });

  it('rejects localhost dependencies, wildcard CORS, and unencrypted Redis in production', () => {
    expect(() => validateEnv({ ...productionBase, CORS_ORIGIN: '*' })).toThrow('CORS_ORIGIN');
    expect(() =>
      validateEnv({ ...productionBase, CORS_ORIGIN: 'https://example.com/path' }),
    ).toThrow('CORS_ORIGIN');
    expect(() =>
      validateEnv({ ...productionBase, CORS_ORIGIN: 'https://example.com.evil/path' }),
    ).toThrow('CORS_ORIGIN');
    expect(() =>
      validateEnv({
        ...productionBase,
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
      }),
    ).toThrow('DATABASE_URL');
    expect(() => validateEnv({ ...productionBase, REDIS_TLS: 'false' })).toThrow('REDIS_TLS');
  });

  it('requires explicit production object-storage configuration', () => {
    const { AWS_S3_BUCKET: _bucket, ...withoutS3Bucket } = productionBase;
    expect(() => validateEnv(withoutS3Bucket)).toThrow('AWS_S3_BUCKET');
    expect(() =>
      validateEnv({
        ...productionBase,
        STORAGE_PROVIDER: 'r2',
        R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
        R2_BUCKET: 'production-user-content',
      }),
    ).toThrow('R2 endpoint, bucket, and credentials');
  });

  it('allows production S3 to use the AWS default credential chain', () => {
    expect(() => validateEnv(productionBase)).not.toThrow();
  });

  it.each([
    { AWS_ACCESS_KEY_ID: 'configured-access-key' },
    { AWS_SECRET_ACCESS_KEY: 'configured-secret-key' },
  ])('rejects an incomplete static AWS credential pair without exposing values', override => {
    const invokeValidation = () => validateEnv({ ...productionBase, ...override });

    expect(invokeValidation).toThrow(
      'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured together',
    );
    expect(invokeValidation).not.toThrow(/configured-(access|secret)-key/);
  });

  it.each([
    { AWS_ACCESS_KEY_ID: ' ', AWS_SECRET_ACCESS_KEY: 'configured-secret-key' },
    { AWS_ACCESS_KEY_ID: 'configured-access-key', AWS_SECRET_ACCESS_KEY: '\t' },
  ])('rejects whitespace-only AWS credentials without exposing values', override => {
    expect(() => validateEnv({ ...productionBase, ...override })).toThrow(
      'must not contain leading or trailing whitespace',
    );
  });

  it('allows a complete temporary AWS credential set', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        AWS_ACCESS_KEY_ID: 'temporary-access-key',
        AWS_SECRET_ACCESS_KEY: 'temporary-secret-key',
        AWS_SESSION_TOKEN: 'temporary-session-token',
      }),
    ).not.toThrow();
  });
});
