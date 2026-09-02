#!/usr/bin/env node
/**
 * Judge0 Remote Sandbox Smoke Verification Tool
 *
 * Executes a deterministic, harmless smoke program against the remote Judge0 sandbox.
 * Emits structured evidence artifact without leaking credentials.
 */

import fs from 'node:fs';
import path from 'node:path';

const JUDGE0_API_URL = process.env.JUDGE0_API_URL;
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;
const FEATURE_LIVE_CODING = process.env.FEATURE_LIVE_CODING === 'true';
const EVIDENCE_DIR = process.env.EVIDENCE_DIR || 'artifacts/judge0';

console.log('============================================================');
console.log('⚖️  Judge0 Remote Sandbox Verification Gate');
console.log('============================================================\n');

if (!FEATURE_LIVE_CODING && !JUDGE0_API_URL) {
  console.log('⚪ FEATURE_LIVE_CODING is false and no JUDGE0_API_URL provided.');
  console.log('   Skipping remote sandbox execution (Feature Gated).');
  process.exit(0);
}

if (!JUDGE0_API_URL) {
  console.error('❌ ERROR: FEATURE_LIVE_CODING=true but JUDGE0_API_URL is missing.');
  process.exit(1);
}

const startTime = Date.now();
const commitSha = process.env.GITHUB_SHA || 'local-dev';

async function runSmokeTest() {
  console.log(`Connecting to Judge0 endpoint: ${JUDGE0_API_URL}`);

  // Harmless TypeScript / Node program (language_id: 63 for JavaScript / Node)
  const payload = {
    source_code: Buffer.from('console.log("judge0-smoke-ok");').toString('base64'),
    language_id: 63,
  };

  const headers = {
    'Content-Type': 'application/json',
  };
  if (JUDGE0_API_KEY) {
    headers['X-Auth-Token'] = JUDGE0_API_KEY;
    headers['X-RapidAPI-Key'] = JUDGE0_API_KEY;
  }

  try {
    const postRes = await fetch(
      `${JUDGE0_API_URL.replace(/\/$/, '')}/submissions?base64_encoded=true&wait=true`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
    );

    if (!postRes.ok) {
      throw new Error(`Judge0 API returned HTTP ${postRes.status}: ${postRes.statusText}`);
    }

    const data = await postRes.json();
    const stdout = data.stdout ? Buffer.from(data.stdout, 'base64').toString('utf8').trim() : '';

    if (!stdout.includes('judge0-smoke-ok')) {
      throw new Error(
        `Judge0 execution stdout mismatch. Expected "judge0-smoke-ok", got: "${stdout}"`,
      );
    }

    const durationMs = Date.now() - startTime;
    console.log(`✅ Judge0 execution successful! (stdout: "${stdout}", duration: ${durationMs}ms)`);

    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const evidencePath = path.join(EVIDENCE_DIR, `judge0-smoke-${Date.now()}.json`);
    const evidence = {
      timestamp: new Date().toISOString(),
      commitSha,
      provider: 'judge0',
      endpointReachable: true,
      executionStatus: 'PASS',
      durationMs,
      overall: 'PASS',
    };
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');
    console.log(`📄 Evidence artifact generated: ${evidencePath}`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Judge0 verification failed: ${err.message}`);
    process.exit(1);
  }
}

runSmokeTest();
