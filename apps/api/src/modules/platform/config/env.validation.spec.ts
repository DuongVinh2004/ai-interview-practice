import { validateEnv } from './env.validation';

const productionBase = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
  JWT_ACCESS_SECRET: 'access-secret-at-least-16-characters',
  JWT_REFRESH_SECRET: 'refresh-secret-at-least-16-characters',
  MFA_ENCRYPTION_KEY: 'test-mfa-encryption-key-32-chars',
  CERTIFICATE_SECRET: 'test-certificate-secret-32-chars',
  AI_PROVIDER: 'openai',
};

describe('validateEnv production mock-provider boundary', () => {
  it.each([
    [{ AI_PROVIDER: 'mock' }, 'AI_PROVIDER=mock'],
    [{ AI_ALLOW_MOCK: 'true' }, 'AI_ALLOW_MOCK=true'],
    [{ ALLOW_MOCK_PROVIDERS: 'true' }, 'ALLOW_MOCK_PROVIDERS=true'],
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
});
