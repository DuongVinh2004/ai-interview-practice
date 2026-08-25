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
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
  THROTTLE_TTL: z.coerce.number().default(60),
  THROTTLE_LIMIT: z.coerce.number().default(100),
  AI_PROVIDER: z
    .enum(['mock', 'gemini', 'openai', 'anthropic', 'router', 'external'])
    .default('mock'),
  OPENAI_API_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),
  AI_MODEL_NAME: z.string().default('mock-model-v1'),
  AI_PROVIDER_PRIORITY: z.string().default('gemini,openai,anthropic,mock'),
  AI_BUDGET_DAILY_USD: z.coerce.number().default(50.0),
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
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  JUDGE0_API_URL: z.string().optional().default(''),
  JUDGE0_API_KEY: z.string().optional().default(''),
  VOICE_STT_PROVIDER: z.string().optional().default('mock'),
  VOICE_TTS_PROVIDER: z.string().optional().default('mock'),
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
  return result.data;
}
