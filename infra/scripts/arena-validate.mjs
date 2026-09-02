#!/usr/bin/env node

/**
 * AnyF Engineering Arena — Challenge Pack Validation CLI
 *
 * Usage:
 *   node infra/scripts/arena-validate.mjs
 *   node infra/scripts/arena-validate.mjs --dir ./challenges/pack-001-profile-bola
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /sk-[a-zA-Z0-9]{32,}/,
  /BEGIN (RSA|EC|OPENSSH) PRIVATE KEY/,
  /postgres:\/\/[^:]+:[^@]+@/,
];

const VALID_RUNTIMES = ['node:22', 'node:20', 'python:3.12', 'python:3.11', 'go:1.23'];

function parseArgs() {
  const args = process.argv.slice(2);
  let targetDir = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) {
      targetDir = args[i + 1];
      i++;
    }
  }
  return { targetDir };
}

export function validateChallengeDir(dirPath) {
  const manifestPath = path.join(dirPath, 'manifest.json');
  const stages = [];
  const start = Date.now();

  if (!fs.existsSync(manifestPath)) {
    return {
      slug: path.basename(dirPath),
      title: 'Unknown',
      overallPass: false,
      stages: [
        {
          stage: '1_SCHEMA_VALIDATION',
          status: 'FAIL',
          message: `Missing manifest.json in ${dirPath}`,
          durationMs: 0,
        },
      ],
    };
  }

  let manifest;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(raw);
  } catch (err) {
    return {
      slug: path.basename(dirPath),
      title: 'Invalid JSON',
      overallPass: false,
      stages: [
        {
          stage: '1_SCHEMA_VALIDATION',
          status: 'FAIL',
          message: `JSON parse error: ${err.message}`,
          durationMs: 0,
        },
      ],
    };
  }

  // 1. Schema Validation
  const s1Start = Date.now();
  const schemaErrors = [];
  if (!manifest.slug) schemaErrors.push('Missing slug');
  if (!manifest.title) schemaErrors.push('Missing title');
  if (!manifest.environment?.runtime) schemaErrors.push('Missing environment.runtime');
  if (!manifest.visibleFiles || !Array.isArray(manifest.visibleFiles))
    schemaErrors.push('visibleFiles must be an array');
  if (!manifest.hiddenFiles || !Array.isArray(manifest.hiddenFiles))
    schemaErrors.push('hiddenFiles must be an array');
  if (!manifest.commands || !Array.isArray(manifest.commands))
    schemaErrors.push('commands must be an array');
  if (!manifest.rubric) schemaErrors.push('Missing rubric configuration');
  if (!manifest.skills || !Array.isArray(manifest.skills))
    schemaErrors.push('skills must be an array');

  // Check rubric weights
  if (manifest.rubric) {
    const totalWeight =
      (manifest.rubric.objectiveWeight || 0) + (manifest.rubric.rubricWeight || 0);
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      schemaErrors.push(
        `Rubric weights (${manifest.rubric.objectiveWeight} + ${manifest.rubric.rubricWeight}) must sum to 1.0`,
      );
    }
  }

  stages.push({
    stage: '1_SCHEMA_VALIDATION',
    status: schemaErrors.length === 0 ? 'PASS' : 'FAIL',
    message:
      schemaErrors.length === 0 ? 'Manifest conforms to schema v1.0' : schemaErrors.join('; '),
    durationMs: Date.now() - s1Start,
  });

  // 2. Source Integrity
  const s2Start = Date.now();
  const missingVisible = [];
  const visibleContent = {};
  for (const relFile of manifest.visibleFiles || []) {
    const fullPath = path.join(dirPath, relFile);
    if (!fs.existsSync(fullPath)) {
      missingVisible.push(relFile);
    } else {
      visibleContent[relFile] = fs.readFileSync(fullPath, 'utf8');
    }
  }

  const missingHidden = [];
  const hiddenContent = {};
  for (const relFile of manifest.hiddenFiles || []) {
    const fullPath = path.join(dirPath, relFile);
    if (!fs.existsSync(fullPath)) {
      missingHidden.push(relFile);
    } else {
      hiddenContent[relFile] = fs.readFileSync(fullPath, 'utf8');
    }
  }

  const sourceErrors = [
    ...missingVisible.map(f => `Missing visible: ${f}`),
    ...missingHidden.map(f => `Missing hidden: ${f}`),
  ];
  stages.push({
    stage: '2_SOURCE_INTEGRITY',
    status: sourceErrors.length === 0 ? 'PASS' : 'FAIL',
    message:
      sourceErrors.length === 0
        ? 'All declared visible and hidden files present'
        : sourceErrors.join('; '),
    durationMs: Date.now() - s2Start,
  });

  // 3. Secrets Scan
  const s3Start = Date.now();
  const secretFindings = [];
  const allFiles = { ...visibleContent, ...hiddenContent };
  for (const [relPath, content] of Object.entries(allFiles)) {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        secretFindings.push(`Potential credential in ${relPath}`);
      }
    }
  }
  stages.push({
    stage: '3_SECRETS_SCAN',
    status: secretFindings.length === 0 ? 'PASS' : 'FAIL',
    message:
      secretFindings.length === 0
        ? 'No hardcoded credentials or private keys detected'
        : secretFindings.join('; '),
    durationMs: Date.now() - s3Start,
  });

  // 4. Runtime Image & Environment Validation
  const s4Start = Date.now();
  const runtime = manifest.environment?.runtime;
  const isRuntimeValid = VALID_RUNTIMES.includes(runtime);
  stages.push({
    stage: '4_RUNTIME_IMAGE_CHECK',
    status: isRuntimeValid ? 'PASS' : 'FAIL',
    message: isRuntimeValid
      ? `Supported runtime: ${runtime}`
      : `Unsupported runtime '${runtime}'. Allowed: ${VALID_RUNTIMES.join(', ')}`,
    durationMs: Date.now() - s4Start,
  });

  // 5. Candidate Artifact Separation
  const s5Start = Date.now();
  const leakedHidden = (manifest.hiddenFiles || []).filter(h => h in visibleContent);
  stages.push({
    stage: '5_CANDIDATE_ARTIFACT_SEPARATION',
    status: leakedHidden.length === 0 ? 'PASS' : 'FAIL',
    message:
      leakedHidden.length === 0
        ? 'Hidden verification tests strictly isolated from candidate files'
        : `Hidden files leaked: ${leakedHidden.join(', ')}`,
    durationMs: Date.now() - s5Start,
  });

  // 6. Rubric and Skills Consistency
  const s6Start = Date.now();
  const skillsValid = (manifest.skills || []).length > 0;
  stages.push({
    stage: '6_RUBRIC_AND_SKILLS',
    status: skillsValid ? 'PASS' : 'FAIL',
    message: skillsValid
      ? `Rubric mapped to ${manifest.skills.length} target taxonomy skills`
      : 'No skills mapped',
    durationMs: Date.now() - s6Start,
  });

  const overallPass = stages.every(s => s.status === 'PASS');
  return {
    slug: manifest.slug,
    title: manifest.title,
    domain: manifest.domain,
    difficulty: manifest.difficulty,
    overallPass,
    stages,
    totalDurationMs: Date.now() - start,
  };
}

export function findChallengeDirs(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  const stat = fs.statSync(baseDir);
  if (!stat.isDirectory()) return [];

  // Check if baseDir itself is a challenge directory
  if (fs.existsSync(path.join(baseDir, 'manifest.json'))) {
    return [baseDir];
  }

  // Scan subdirectories
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const challengeDirs = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subPath = path.join(baseDir, entry.name);
      if (fs.existsSync(path.join(subPath, 'manifest.json'))) {
        challengeDirs.push(subPath);
      }
    }
  }
  return challengeDirs.sort();
}

async function main() {
  const { targetDir } = parseArgs();
  const rootDir = process.cwd();
  const scanTarget = targetDir
    ? path.resolve(rootDir, targetDir)
    : path.resolve(rootDir, 'challenges');

  console.log('\n==============================================================================');
  console.log('🛡️  [AnyF Engineering Arena] Automated Challenge Pack Validator (6-Stage CI)');
  console.log(`📁 Target Directory: ${scanTarget}`);
  console.log('==============================================================================\n');

  const challengeDirs = findChallengeDirs(scanTarget);

  if (challengeDirs.length === 0) {
    console.error(`❌ No challenge directories with manifest.json found in: ${scanTarget}`);
    process.exit(1);
  }

  let totalChallenges = 0;
  let passedChallenges = 0;
  let failedChallenges = 0;

  for (const dir of challengeDirs) {
    totalChallenges++;
    const result = validateChallengeDir(dir);

    console.log(`📦 Challenge [${totalChallenges}/${challengeDirs.length}]: ${result.slug}`);
    console.log(`   Title: ${result.title}`);
    console.log(`   Status: ${result.overallPass ? '✅ PASS' : '❌ FAIL'}`);

    for (const stage of result.stages) {
      const icon = stage.status === 'PASS' ? '✓' : '✗';
      console.log(`     ${icon} [${stage.stage}] ${stage.message} (${stage.durationMs}ms)`);
    }
    console.log('');

    if (result.overallPass) {
      passedChallenges++;
    } else {
      failedChallenges++;
    }
  }

  console.log('==============================================================================');
  console.log(`📊 [Validation Summary]`);
  console.log(`   Total Challenges Scanned: ${totalChallenges}`);
  console.log(`   Passed: ${passedChallenges} ✅ | Failed: ${failedChallenges} ❌`);
  console.log('==============================================================================\n');

  if (failedChallenges > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (process.argv[1] && process.argv[1].endsWith('arena-validate.mjs')) {
  main().catch(err => {
    console.error('Fatal validator error:', err);
    process.exit(1);
  });
}
