#!/usr/bin/env node
/**
 * Voice Providers Preflight Verification Tool
 *
 * Verifies Deepgram (STT) and ElevenLabs (TTS) API connectivity and authentication.
 * Uses synthetic/dummy payload without exposing or processing any customer PII.
 */

import fs from 'node:fs';
import path from 'node:path';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const FEATURE_VOICE_STREAMING = process.env.FEATURE_VOICE_STREAMING === 'true';
const EVIDENCE_DIR = process.env.EVIDENCE_DIR || 'artifacts/voice';

console.log('============================================================');
console.log('🎙️  Voice Providers Preflight Verification Gate');
console.log('============================================================\n');

if (!FEATURE_VOICE_STREAMING && !DEEPGRAM_API_KEY && !ELEVENLABS_API_KEY) {
  console.log('⚪ FEATURE_VOICE_STREAMING is false and no keys provided.');
  console.log('   Skipping voice provider verification (Feature Gated).');
  process.exit(0);
}

const startTime = Date.now();
const results = { deepgram: 'SKIPPED', elevenlabs: 'SKIPPED' };

async function verifyVoiceProviders() {
  // 1. Deepgram Ping
  if (DEEPGRAM_API_KEY) {
    console.log('Checking Deepgram STT connectivity...');
    try {
      const res = await fetch('https://api.deepgram.com/v1/projects', {
        headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
      });
      if (res.ok) {
        console.log('✅ Deepgram STT API authenticated successfully.');
        results.deepgram = 'PASS';
      } else {
        console.warn(`⚠️ Deepgram returned HTTP ${res.status}: ${res.statusText}`);
        results.deepgram = 'FAIL';
      }
    } catch (err) {
      console.warn(`⚠️ Deepgram connection error: ${err.message}`);
      results.deepgram = 'FAIL';
    }
  }

  // 2. ElevenLabs Ping
  if (ELEVENLABS_API_KEY) {
    console.log('Checking ElevenLabs TTS connectivity...');
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      });
      if (res.ok) {
        console.log('✅ ElevenLabs TTS API authenticated successfully.');
        results.elevenlabs = 'PASS';
      } else {
        console.warn(`⚠️ ElevenLabs returned HTTP ${res.status}: ${res.statusText}`);
        results.elevenlabs = 'FAIL';
      }
    } catch (err) {
      console.warn(`⚠️ ElevenLabs connection error: ${err.message}`);
      results.elevenlabs = 'FAIL';
    }
  }

  const durationMs = Date.now() - startTime;
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const evidencePath = path.join(EVIDENCE_DIR, `voice-readiness-${Date.now()}.json`);
  const evidence = {
    timestamp: new Date().toISOString(),
    featureVoiceStreaming: FEATURE_VOICE_STREAMING,
    results,
    durationMs,
    overall: results.deepgram !== 'FAIL' && results.elevenlabs !== 'FAIL' ? 'PASS' : 'WARN',
  };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');
  console.log(`📄 Evidence artifact generated: ${evidencePath}`);

  if (FEATURE_VOICE_STREAMING && (results.deepgram === 'FAIL' || results.elevenlabs === 'FAIL')) {
    process.exit(1);
  }
  process.exit(0);
}

verifyVoiceProviders();
