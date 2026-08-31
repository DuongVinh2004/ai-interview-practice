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
  tls: process.env.REDIS_TLS === 'true',
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
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  modelName: process.env.AI_MODEL_NAME || 'mock-model-v1',
  providerPriority: process.env.AI_PROVIDER_PRIORITY || 'gemini,openai,anthropic,mock',
  dailyBudgetUsd: parseFloat(process.env.AI_BUDGET_DAILY_USD || '50.0'),
  maxProviderCallCostUsd: parseFloat(process.env.AI_MAX_PROVIDER_CALL_COST_USD || '2.0'),
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
  questionBank: process.env.FEATURE_QUESTION_BANK !== 'false',
}));

export const storageConfig = registerAs('storage', () => ({
  provider: process.env.STORAGE_PROVIDER || 'mock',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  awsSessionToken: process.env.AWS_SESSION_TOKEN || '',
  awsRegion: process.env.AWS_REGION || 'ap-southeast-1',
  awsS3Bucket: process.env.AWS_S3_BUCKET || 'ai-interview-bucket',
  r2Endpoint: process.env.R2_ENDPOINT || '',
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  r2Bucket: process.env.R2_BUCKET || 'ai-interview-r2',
  publicCdnUrl: process.env.STORAGE_PUBLIC_CDN_URL || '',
}));

export const emailConfig = registerAs('email', () => ({
  provider: process.env.EMAIL_PROVIDER || 'mock',
  resendApiKey: process.env.RESEND_API_KEY || '',
  defaultFrom: process.env.EMAIL_DEFAULT_FROM || 'AI Interview <noreply@ai-interview.com>',
}));

export const billingConfig = registerAs('billing', () => ({
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  payosClientId: process.env.PAYOS_CLIENT_ID || '',
  payosApiKey: process.env.PAYOS_API_KEY || '',
  payosChecksumKey: process.env.PAYOS_CHECKSUM_KEY || '',
}));

export const voiceConfig = registerAs('voice', () => ({
  sttProvider: process.env.VOICE_STT_PROVIDER || 'mock',
  ttsProvider: process.env.VOICE_TTS_PROVIDER || 'mock',
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || '',
  elevenlabsVoiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
}));

export const visionConfig = registerAs('vision', () => ({
  provider: process.env.VISION_PROVIDER || 'mock',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
}));
