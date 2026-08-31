import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().url(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_TLS: z.enum(['true', 'false']).default('false'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
  MFA_ENCRYPTION_KEY: z.string().min(32).optional(),
  CERTIFICATE_SECRET: z.string().min(32).optional(),
  THROTTLE_TTL: z.coerce.number().default(60),
  THROTTLE_LIMIT: z.coerce.number().default(100),
  AUTH_REFRESH_THROTTLE_LIMIT: z.coerce.number().int().positive().default(60),
  AI_PROVIDER: z
    .enum(['mock', 'gemini', 'openai', 'anthropic', 'router', 'external'])
    .default('mock'),
  AI_ALLOW_MOCK: z.enum(['true', 'false']).default('false'),
  ALLOW_MOCK_PROVIDERS: z.enum(['true', 'false']).default('false'),
  PROCESS_ROLE: z.enum(['api', 'worker']).default('api'),
  METRICS_EXPORTER_ENABLED: z.enum(['true', 'false']).default('false'),
  METRICS_EXPORTER_HOST: z.string().min(1).default('127.0.0.1'),
  METRICS_EXPORTER_PORT: z.coerce.number().int().min(1).max(65535).default(9091),
  METRICS_AUTH_TOKEN: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-3.6-flash'),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),
  AI_MODEL_NAME: z.string().default('mock-model-v1'),
  AI_PROVIDER_PRIORITY: z.string().default('gemini,openai,anthropic,mock'),
  AI_BUDGET_DAILY_USD: z.coerce.number().positive().default(50.0),
  AI_MAX_PROVIDER_CALL_COST_USD: z.coerce.number().positive().default(2.0),
  AI_TIMEOUT_MS: z.coerce.number().default(10000),
  AI_MAX_RETRIES: z.coerce.number().default(2),
  FEATURE_SEMANTIC_CACHE: z.string().optional().default('false'),
  FEATURE_LIVE_CODING: z.string().optional().default('false'),
  FEATURE_BEHAVIORAL_INTERVIEW: z.string().optional().default('false'),
  FEATURE_BILLING: z.string().optional().default('false'),
  FEATURE_JD_RESUME_PARSER: z.string().optional().default('false'),
  FEATURE_SOCRATIC_TUTOR: z.string().optional().default('false'),
  FEATURE_SPACED_REPETITION: z.string().optional().default('false'),
  FEATURE_VOICE_STREAMING: z.string().optional().default('false'),
  FEATURE_QUESTION_BANK: z.string().optional().default('true'),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  JUDGE0_API_URL: z.string().optional().default(''),
  JUDGE0_API_KEY: z.string().optional().default(''),
  VOICE_STT_PROVIDER: z.string().optional().default('mock'),
  VOICE_TTS_PROVIDER: z.string().optional().default('mock'),
  STORAGE_PROVIDER: z.enum(['mock', 's3', 'r2']).default('mock'),
  AWS_ACCESS_KEY_ID: z.string().optional().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(''),
  AWS_SESSION_TOKEN: z.string().optional().default(''),
  AWS_REGION: z.string().optional().default('ap-southeast-1'),
  AWS_S3_BUCKET: z.string().optional().default('ai-interview-bucket'),
  R2_ENDPOINT: z.string().optional().default(''),
  R2_ACCESS_KEY_ID: z.string().optional().default(''),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(''),
  R2_BUCKET: z.string().optional().default('ai-interview-r2'),
  STORAGE_PUBLIC_CDN_URL: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_PROVIDER: z.string().optional().default('mock'),
  EMAIL_DEFAULT_FROM: z.string().optional().default('AI Interview <noreply@ai-interview.com>'),
  DEEPGRAM_API_KEY: z.string().optional().default(''),
  ELEVENLABS_API_KEY: z.string().optional().default(''),
  ELEVENLABS_VOICE_ID: z.string().optional().default('21m00Tcm4TlvDq8ikWAM'),
  PAYOS_CLIENT_ID: z.string().optional().default(''),
  PAYOS_API_KEY: z.string().optional().default(''),
  PAYOS_CHECKSUM_KEY: z.string().optional().default(''),
  VISION_PROVIDER: z.string().optional().default('mock'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map(err => `${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`❌ Configuration validation error:\n${errorDetails}`);
  }
  const awsCredentialVariables = [
    ['AWS_ACCESS_KEY_ID', result.data.AWS_ACCESS_KEY_ID],
    ['AWS_SECRET_ACCESS_KEY', result.data.AWS_SECRET_ACCESS_KEY],
    ['AWS_SESSION_TOKEN', result.data.AWS_SESSION_TOKEN],
  ] as const;
  const invalidWhitespaceVariable = awsCredentialVariables.find(
    ([, value]) => Boolean(value) && value.trim() !== value,
  );
  if (invalidWhitespaceVariable) {
    throw new Error(
      `❌ Configuration validation error:\n${invalidWhitespaceVariable[0]} must not contain leading or trailing whitespace`,
    );
  }
  const hasAwsAccessKeyId = Boolean(result.data.AWS_ACCESS_KEY_ID);
  const hasAwsSecretAccessKey = Boolean(result.data.AWS_SECRET_ACCESS_KEY);
  if (hasAwsAccessKeyId !== hasAwsSecretAccessKey) {
    throw new Error(
      '❌ Configuration validation error:\nAWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured together',
    );
  }
  if (result.data.AWS_SESSION_TOKEN && !hasAwsAccessKeyId) {
    throw new Error(
      '❌ Configuration validation error:\nAWS_SESSION_TOKEN requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY',
    );
  }
  if (result.data.NODE_ENV === 'production') {
    const missingSecrets = ['MFA_ENCRYPTION_KEY', 'CERTIFICATE_SECRET'].filter(
      key => !result.data[key as keyof EnvConfig],
    );
    if (missingSecrets.length > 0) {
      throw new Error(
        `❌ Configuration validation error:\n${missingSecrets.join(', ')} must be configured in production`,
      );
    }
    const origins = result.data.CORS_ORIGIN.split(',').map(origin => origin.trim());
    const invalidOrigin = origins.some(origin => {
      try {
        const parsed = new URL(origin);
        return (
          parsed.protocol !== 'https:' ||
          parsed.origin !== origin ||
          Boolean(parsed.username || parsed.password) ||
          parsed.pathname !== '/' ||
          Boolean(parsed.search || parsed.hash)
        );
      } catch {
        return true;
      }
    });
    if (origins.length === 0 || invalidOrigin) {
      throw new Error(
        '❌ Configuration validation error:\nCORS_ORIGIN must contain only explicit HTTPS origins in production',
      );
    }
    if (
      result.data.JWT_ACCESS_SECRET === result.data.JWT_REFRESH_SECRET ||
      result.data.JWT_ACCESS_SECRET.includes('dev-access-secret') ||
      result.data.JWT_REFRESH_SECRET.includes('dev-refresh-secret')
    ) {
      throw new Error(
        '❌ Configuration validation error:\nJWT access and refresh secrets must be distinct production secrets',
      );
    }
    const databaseHost = new URL(result.data.DATABASE_URL).hostname;
    if (['localhost', '127.0.0.1', '::1'].includes(databaseHost)) {
      throw new Error(
        '❌ Configuration validation error:\nDATABASE_URL cannot target localhost in production',
      );
    }
    if (
      ['localhost', '127.0.0.1', '::1'].includes(result.data.REDIS_HOST) ||
      result.data.REDIS_PASSWORD.length < 16
    ) {
      throw new Error(
        '❌ Configuration validation error:\nProduction Redis must be remote and protected by a password of at least 16 characters',
      );
    }
    if (result.data.REDIS_TLS !== 'true') {
      throw new Error('❌ Configuration validation error:\nREDIS_TLS must be true in production');
    }
    const insecureMockSettings = [
      result.data.AI_PROVIDER === 'mock' ? 'AI_PROVIDER=mock' : null,
      result.data.AI_ALLOW_MOCK === 'true' ? 'AI_ALLOW_MOCK=true' : null,
      result.data.ALLOW_MOCK_PROVIDERS === 'true' ? 'ALLOW_MOCK_PROVIDERS=true' : null,
    ].filter((value): value is string => value !== null);
    if (insecureMockSettings.length > 0) {
      throw new Error(
        `❌ Configuration validation error:\nMock providers are forbidden in production: ${insecureMockSettings.join(', ')}`,
      );
    }
    if (result.data.STORAGE_PROVIDER === 'mock') {
      throw new Error(
        '❌ Configuration validation error:\nSTORAGE_PROVIDER=mock is forbidden in production',
      );
    }
    if (
      result.data.STORAGE_PROVIDER === 's3' &&
      (!config.AWS_S3_BUCKET || String(config.AWS_S3_BUCKET).trim().length === 0)
    ) {
      throw new Error(
        '❌ Configuration validation error:\nAWS_S3_BUCKET must be explicitly configured for production S3 storage',
      );
    }
    if (
      result.data.STORAGE_PROVIDER === 'r2' &&
      (!result.data.R2_ENDPOINT ||
        !result.data.R2_ACCESS_KEY_ID ||
        !result.data.R2_SECRET_ACCESS_KEY ||
        !config.R2_BUCKET ||
        String(config.R2_BUCKET).trim().length === 0)
    ) {
      throw new Error(
        '❌ Configuration validation error:\nR2 endpoint, bucket, and credentials must be explicitly configured for production R2 storage',
      );
    }
    const configuredProviders = [
      result.data.GEMINI_API_KEY,
      result.data.OPENAI_API_KEY,
      result.data.ANTHROPIC_API_KEY,
    ].filter(Boolean);
    if (configuredProviders.length === 0) {
      throw new Error(
        '❌ Configuration validation error:\nAt least one production AI provider credential must be configured',
      );
    }
    if (
      result.data.METRICS_EXPORTER_ENABLED === 'true' &&
      result.data.METRICS_AUTH_TOKEN.length < 32
    ) {
      throw new Error(
        '❌ Configuration validation error:\nMETRICS_AUTH_TOKEN must contain at least 32 characters when the metrics exporter is enabled',
      );
    }
    if (result.data.AI_MAX_PROVIDER_CALL_COST_USD > result.data.AI_BUDGET_DAILY_USD) {
      throw new Error(
        '❌ Configuration validation error:\nAI_MAX_PROVIDER_CALL_COST_USD cannot exceed AI_BUDGET_DAILY_USD',
      );
    }
  }
  return result.data;
}
