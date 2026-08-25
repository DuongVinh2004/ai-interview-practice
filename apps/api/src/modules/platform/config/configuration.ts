import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
}));

export const dbConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
}));

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-min-32-chars-ok',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-min-32-chars-ok',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
}));

export const aiConfig = registerAs('ai', () => ({
  provider: process.env.AI_PROVIDER || 'mock',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  modelName: process.env.AI_MODEL_NAME || 'mock-model-v1',
  providerPriority: process.env.AI_PROVIDER_PRIORITY || 'gemini,openai,anthropic,mock',
  dailyBudgetUsd: parseFloat(process.env.AI_BUDGET_DAILY_USD || '50.0'),
  timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '10000', 10),
  maxRetries: parseInt(process.env.AI_MAX_RETRIES || '2', 10),
}));

export const featuresConfig = registerAs('features', () => ({
  semanticCache: process.env.FEATURE_SEMANTIC_CACHE === 'true',
  liveCoding: process.env.FEATURE_LIVE_CODING === 'true',
  behavioralInterview: process.env.FEATURE_BEHAVIORAL_INTERVIEW === 'true',
  billing: process.env.FEATURE_BILLING === 'true',
  jdResumeParser: process.env.FEATURE_JD_RESUME_PARSER === 'true',
  socraticTutor: process.env.FEATURE_SOCRATIC_TUTOR === 'true',
  spacedRepetition: process.env.FEATURE_SPACED_REPETITION === 'true',
  voiceStreaming: process.env.FEATURE_VOICE_STREAMING === 'true',
}));
