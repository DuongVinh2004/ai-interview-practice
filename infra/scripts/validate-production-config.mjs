#!/usr/bin/env node
/**
 * Production Configuration & Pre-Deployment Secrets Validator
 *
 * Validates production environment variables against security policies without
 * printing, logging, or leaking sensitive secret values.
 */

import { URL } from 'node:url';

const env = process.env;
const isProduction = env.NODE_ENV === 'production';
let hasErrors = false;

console.log('============================================================');
console.log('🛡️  Production Configuration & Pre-Deployment Secret Guard');
console.log(`🌍 Target Environment: ${env.NODE_ENV || 'development'}`);
console.log('============================================================\n');

function checkField(name, validator, isSecret = false) {
  const value = env[name];
  const present = Boolean(value && value.trim().length > 0);

  if (!present) {
    console.log(`❌ ${name.padEnd(30)} [MISSING]`);
    hasErrors = true;
    return false;
  }

  try {
    const valid = validator(value);
    if (!valid) {
      console.log(`❌ ${name.padEnd(30)} [INVALID FORMAT / CONSTRAINT VIOLATION]`);
      hasErrors = true;
      return false;
    }
    console.log(`✅ ${name.padEnd(30)} [${isSecret ? 'PRESENT & VALIDATED' : 'VALID'}]`);
    return true;
  } catch (err) {
    console.log(`❌ ${name.padEnd(30)} [ERROR: ${err.message}]`);
    hasErrors = true;
    return false;
  }
}

// 1. Core Secrets
console.log('--- [1. Core Authentication & Encryption Secrets] ---');
checkField('JWT_ACCESS_SECRET', val => val.length >= 32, true);
checkField('JWT_REFRESH_SECRET', val => val.length >= 32 && val !== env.JWT_ACCESS_SECRET, true);
checkField('MFA_ENCRYPTION_KEY', val => val.length >= 32, true);
checkField('CERTIFICATE_SECRET', val => val.length >= 32, true);

// 2. Database & Redis Connectivity
console.log('\n--- [2. Database & Cache Infrastructure] ---');
checkField(
  'DATABASE_URL',
  val => {
    const parsed = new URL(val);
    if (isProduction && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
      throw new Error('Database host cannot be localhost in production');
    }
    return ['postgresql:', 'postgres:'].includes(parsed.protocol);
  },
  true,
);

checkField('REDIS_HOST', val => {
  if (isProduction && ['localhost', '127.0.0.1', '::1'].includes(val)) {
    throw new Error('Redis host cannot be localhost in production');
  }
  return true;
});

checkField('REDIS_PASSWORD', val => val.length >= 16, true);
checkField('REDIS_TLS', val => (isProduction ? val === 'true' : true));

// 3. AI Providers & Model Routing
console.log('\n--- [3. AI Providers & Security Boundaries] ---');
if (isProduction) {
  const mockProhibited = env.AI_PROVIDER !== 'mock' && env.ALLOW_MOCK_PROVIDERS !== 'true';
  if (!mockProhibited) {
    console.log('❌ AI_PROVIDER / ALLOW_MOCK    [MOCK PROVIDERS STRICTLY FORBIDDEN IN PROD]');
    hasErrors = true;
  } else {
    console.log('✅ AI_PROVIDER / ALLOW_MOCK    [NO MOCK ESCAPE]');
  }

  const aiKeys = [env.GEMINI_API_KEY, env.OPENAI_API_KEY, env.ANTHROPIC_API_KEY].filter(k =>
    Boolean(k && k.trim().length > 0),
  );
  if (aiKeys.length === 0) {
    console.log('❌ AI_PROVIDER_KEYS            [AT LEAST ONE REAL AI PROVIDER KEY REQUIRED]');
    hasErrors = true;
  } else {
    console.log(`✅ AI_PROVIDER_KEYS            [${aiKeys.length} REAL PROVIDERS CONFIGURED]`);
  }
}

// 4. Feature-Gated Configurations
console.log('\n--- [4. Feature-Gated External Integrations] ---');
if (env.FEATURE_LIVE_CODING === 'true') {
  console.log('⚙️  Feature Live Coding: ENABLED');
  checkField('JUDGE0_API_URL', val => {
    const parsed = new URL(val);
    return ['http:', 'https:'].includes(parsed.protocol);
  });
  checkField('JUDGE0_API_KEY', val => val.length >= 10, true);
} else {
  console.log('⚪ Feature Live Coding: DISABLED (Judge0 check skipped)');
}

if (env.FEATURE_VOICE_STREAMING === 'true') {
  console.log('⚙️  Feature Voice Streaming: ENABLED');
  checkField('DEEPGRAM_API_KEY', val => val.length >= 16, true);
  checkField('ELEVENLABS_API_KEY', val => val.length >= 16, true);
} else {
  console.log('⚪ Feature Voice Streaming: DISABLED (Voice provider check skipped)');
}

if (env.FEATURE_BILLING === 'true') {
  console.log('⚙️  Feature Billing: ENABLED');
  checkField('STRIPE_SECRET_KEY', val => val.startsWith('sk_'), true);
  checkField('STRIPE_WEBHOOK_SECRET', val => val.startsWith('whsec_'), true);
  checkField('PAYOS_API_KEY', val => val.length >= 16, true);
} else {
  console.log('⚪ Feature Billing: DISABLED (Payment gateway check skipped)');
}

console.log('\n============================================================');
if (hasErrors) {
  console.error('❌ Configuration validation FAILED: One or more constraints violated.');
  process.exit(1);
} else {
  console.log('✅ Configuration validation PASSED: Pre-deployment environment is sound.');
  process.exit(0);
}
