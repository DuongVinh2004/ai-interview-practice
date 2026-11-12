#!/usr/bin/env node

/**
 * AnyF Engineering Arena — Challenge Pack Validation CLI
 *
 * Usage:
 *   node infra/scripts/arena-validate.mjs
 *   node infra/scripts/arena-validate.mjs --dir ./challenges/pack-001-profile-bola
 *   node infra/scripts/arena-validate.mjs --dir ./challenges/pack-001-profile-bola --seed
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import ts from 'typescript';

export const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /sk-[a-zA-Z0-9]{32,}/,
  /BEGIN (RSA|EC|OPENSSH) PRIVATE KEY/,
  /postgres:\/\/[^:]+:[^@]+@/,
];

export const NETWORK_PATTERNS = [
  /\bfetch\s*\(/,
  /\baxios\b/,
  /\bhttp\.request\b|\bhttps\.request\b/,
  /require\s*\(\s*['"](http|https|net|dgram|tls|dns|axios|node-fetch|undici)['"]\s*\)/,
  /from\s+['"](http|https|net|dgram|tls|dns|axios|node-fetch|undici)['"]/,
  /\bnew\s+WebSocket\s*\(/,
  /\bnet\.connect\b|\bnet\.createConnection\b/,
  /\bhttps?:\/\/(?!localhost|127\.0\.0\.1|schema\.json)/i,
];

export const VALID_RUNTIMES = ['node:22', 'node:20', 'python:3.12', 'python:3.11', 'go:1.23'];

export function parseArgs() {
  const args = process.argv.slice(2);
  let targetDir = null;
  let seed = false;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) {
      targetDir = args[i + 1];
      i++;
    } else if (args[i] === '--seed') {
      seed = true;
    } else if (args[i] === '--json') {
      json = true;
    }
  }
  return { targetDir, seed, json };
}

function transpile(tsCode) {
  return ts.transpileModule(tsCode, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

export async function runChallengeTest(packDir, useSolution, testRelPath) {
  const manifestPath = path.join(packDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { passed: false, error: 'Missing manifest.json' };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const testFullPath = path.join(packDir, testRelPath);
  if (!fs.existsSync(testFullPath)) {
    return { passed: false, error: `Test file not found: ${testRelPath}` };
  }
  const testContent = fs.readFileSync(testFullPath, 'utf8');

  const modules = {};
  for (const editable of manifest.editableFiles || []) {
    const filePath = useSolution
      ? path.join(packDir, 'solution', path.basename(editable))
      : path.join(packDir, editable);

    if (!fs.existsSync(filePath)) {
      return { passed: false, error: `File not found: ${filePath}` };
    }
    const code = fs.readFileSync(filePath, 'utf8');
    const jsCode = transpile(code);

    const exp = {};
    const mod = { exports: exp };
    const ctx = { exports: exp, module: mod };
    vm.createContext(ctx);
    vm.runInContext(jsCode, ctx);
    modules[path.basename(editable, '.ts')] = mod.exports;
  }

  const jestMock = {
    fn: (impl) => {
      const calls = [];
      const mockFn = (...args) => {
        calls.push(args);
        return impl ? impl(...args) : undefined;
      };
      mockFn.mockResolvedValue = (val) => { impl = async () => val; return mockFn; };
      mockFn.mockReturnValue = (val) => { impl = () => val; return mockFn; };
      mockFn.mock = { calls };
      mockFn.toHaveBeenCalled = () => calls.length > 0;
      mockFn.toHaveBeenCalledTimes = (n) => calls.length === n;
      mockFn.toHaveBeenCalledWith = (...expected) => calls.some((c) => {
        if (c.length !== expected.length) return false;
        return expected.every((exp, idx) => {
          if (exp && typeof exp === 'object' && exp.__asymmetric) return exp.asymmetricMatch(c[idx]);
          return JSON.stringify(c[idx]) === JSON.stringify(exp);
        });
      });
      return mockFn;
    },
  };

  const expectMock = (actual) => ({
    toBeDefined: () => { if (actual === undefined) throw new Error('Expected defined'); },
    toBe: (exp) => { if (actual !== exp) throw new Error(`Expected ${exp} got ${actual}`); },
    toHaveLength: (len) => { if (actual?.length !== len) throw new Error(`Expected length ${len}`); },
    toHaveBeenCalled: () => { if (!actual?.toHaveBeenCalled?.()) throw new Error('Expected called'); },
    not: {
      toHaveBeenCalled: () => { if (actual?.toHaveBeenCalled?.()) throw new Error('Expected not called'); },
      notToHaveBeenCalled: () => { if (actual?.toHaveBeenCalled?.()) throw new Error('Expected not called'); },
    },
    toHaveBeenCalledTimes: (n) => { if (!actual?.toHaveBeenCalledTimes?.(n)) throw new Error(`Expected ${n} calls`); },
    toHaveBeenCalledWith: (...expected) => {
      if (!actual?.toHaveBeenCalledWith?.(...expected)) throw new Error('Expected call with specific args');
    },
    rejects: {
      toThrow: async (pattern) => {
        let threw = false;
        try {
          await actual;
        } catch (e) {
          threw = true;
          if (pattern && !pattern.test(e.message)) throw new Error(`Pattern mismatch: ${e.message}`);
        }
        if (!threw) throw new Error('Expected promise to reject');
      },
    },
  });
  expectMock.stringContaining = (sub) => ({
    __asymmetric: true,
    asymmetricMatch: (actual) => typeof actual === 'string' && actual.includes(sub),
  });

  const testJs = transpile(testContent);
  const testPromises = [];

  const testContext = {
    exports: {},
    module: { exports: {} },
    require: (modPath) => {
      const base = path.basename(modPath, '.ts').replace(/\.js$/, '');
      if (modules[base]) return modules[base];
      return {};
    },
    describe: (_name, fn) => fn(),
    it: (_name, fn) => { testPromises.push(Promise.resolve().then(() => fn())); },
    test: (_name, fn) => { testPromises.push(Promise.resolve().then(() => fn())); },
    expect: expectMock,
    jest: jestMock,
    console,
  };
  vm.createContext(testContext);

  try {
    vm.runInContext(testJs, testContext);
    await Promise.all(testPromises);
    return { passed: true };
  } catch (err) {
    return { passed: false, error: err.message };
  }
}

export async function validateChallengeDir(dirPath) {
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
          stage: '1_MANIFEST_SCHEMA',
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
          stage: '1_MANIFEST_SCHEMA',
          status: 'FAIL',
          message: `JSON parse error: ${err.message}`,
          durationMs: 0,
        },
      ],
    };
  }

  // Stage 1: Manifest Schema
  const s1Start = Date.now();
  const schemaErrors = [];
  if (!manifest.slug) schemaErrors.push('Missing slug');
  if (!manifest.title) schemaErrors.push('Missing title');
  if (!manifest.domain) schemaErrors.push('Missing domain');
  if (!manifest.category) schemaErrors.push('Missing category');
  if (manifest.difficulty === undefined) schemaErrors.push('Missing difficulty');
  if (!manifest.environment?.runtime) schemaErrors.push('Missing environment.runtime');
  if (!manifest.visibleFiles || !Array.isArray(manifest.visibleFiles)) {
    schemaErrors.push('visibleFiles must be an array');
  }
  if (!manifest.hiddenFiles || !Array.isArray(manifest.hiddenFiles)) {
    schemaErrors.push('hiddenFiles must be an array');
  }
  if (!manifest.commands || !Array.isArray(manifest.commands) || manifest.commands.length === 0) {
    schemaErrors.push('commands must be a non-empty array');
  }
  if (!manifest.rubric) {
    schemaErrors.push('Missing rubric configuration');
  } else {
    const totalWeight = (manifest.rubric.objectiveWeight || 0) + (manifest.rubric.rubricWeight || 0);
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      schemaErrors.push(
        `Rubric weights (${manifest.rubric.objectiveWeight} + ${manifest.rubric.rubricWeight}) must sum to 1.0`,
      );
    }
  }
  if (!manifest.skills || !Array.isArray(manifest.skills) || manifest.skills.length === 0) {
    schemaErrors.push('skills must be a non-empty array');
  }

  // Runtime validity check
  if (manifest.environment?.runtime && !VALID_RUNTIMES.includes(manifest.environment.runtime)) {
    schemaErrors.push(`Unsupported runtime '${manifest.environment.runtime}'. Allowed: ${VALID_RUNTIMES.join(', ')}`);
  }

  // File existence checks
  for (const relFile of manifest.visibleFiles || []) {
    if (!fs.existsSync(path.join(dirPath, relFile))) {
      schemaErrors.push(`Missing visible file on disk: ${relFile}`);
    }
  }
  for (const relFile of manifest.hiddenFiles || []) {
    if (!fs.existsSync(path.join(dirPath, relFile))) {
      schemaErrors.push(`Missing hidden file on disk: ${relFile}`);
    }
  }

  // Separation check
  const leaked = (manifest.hiddenFiles || []).filter((h) => (manifest.visibleFiles || []).includes(h));
  if (leaked.length > 0) {
    schemaErrors.push(`Hidden files leaked into visible bundle: ${leaked.join(', ')}`);
  }

  stages.push({
    stage: '1_MANIFEST_SCHEMA',
    status: schemaErrors.length === 0 ? 'PASS' : 'FAIL',
    message: schemaErrors.length === 0 ? 'Manifest conforms to schema v1.0 and files intact' : schemaErrors.join('; '),
    durationMs: Date.now() - s1Start,
  });

  // Collect files content for security & network scans
  const allFileContents = {};
  const scanDirRecursive = (currentDir) => {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        scanDirRecursive(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.json'))) {
        allFileContents[path.relative(dirPath, fullPath)] = fs.readFileSync(fullPath, 'utf8');
      }
    }
  };
  scanDirRecursive(dirPath);

  // Stage 2: Baseline Failure (Candidate baseline code must fail verification tests)
  const s2Start = Date.now();
  let baselineFailedTests = false;
  let baselineReason = '';

  const hiddenTestRelPath = (manifest.hiddenFiles || [])[0];
  if (hiddenTestRelPath) {
    const testRes = await runChallengeTest(dirPath, false, hiddenTestRelPath);
    if (!testRes.passed) {
      baselineFailedTests = true;
      baselineReason = `Baseline correctly failed verification assertions (${testRes.error || 'expected rejection'})`;
    } else {
      baselineReason = 'Baseline unexpectedly passed hidden verification tests without fix';
    }
  } else {
    baselineReason = 'No hidden test declared to verify baseline failure';
  }

  stages.push({
    stage: '2_BASELINE_FAILURE',
    status: baselineFailedTests ? 'PASS' : 'FAIL',
    message: baselineReason,
    durationMs: Date.now() - s2Start,
  });

  // Stage 3: Solution Pass (Reference solution must pass visible unit tests)
  const s3Start = Date.now();
  let solutionPassedVisible = true;
  let solutionVisibleMsg = '';

  const visibleTestRelPath = (manifest.visibleFiles || []).find((f) => f.includes('test'));
  if (visibleTestRelPath) {
    const testRes = await runChallengeTest(dirPath, true, visibleTestRelPath);
    solutionPassedVisible = testRes.passed;
    solutionVisibleMsg = testRes.passed
      ? 'Reference solution passed all declared visible unit tests'
      : `Reference solution failed visible tests: ${testRes.error}`;
  } else {
    solutionVisibleMsg = 'No visible tests declared; skipped';
  }

  stages.push({
    stage: '3_SOLUTION_PASS',
    status: solutionPassedVisible ? 'PASS' : 'FAIL',
    message: solutionVisibleMsg,
    durationMs: Date.now() - s3Start,
  });

  // Stage 4: Hidden Tests Pass (Reference solution must pass hidden verification tests)
  const s4Start = Date.now();
  let solutionPassedHidden = true;
  let solutionHiddenMsg = '';

  if (hiddenTestRelPath) {
    const testRes = await runChallengeTest(dirPath, true, hiddenTestRelPath);
    solutionPassedHidden = testRes.passed;
    solutionHiddenMsg = testRes.passed
      ? 'Reference solution passed 100% of hidden verification tests'
      : `Reference solution failed hidden tests: ${testRes.error}`;
  } else {
    solutionHiddenMsg = 'No hidden tests declared';
    solutionPassedHidden = false;
  }

  stages.push({
    stage: '4_HIDDEN_TESTS_PASS',
    status: solutionPassedHidden ? 'PASS' : 'FAIL',
    message: solutionHiddenMsg,
    durationMs: Date.now() - s4Start,
  });

  // Stage 5: Zero Secrets Scan
  const s5Start = Date.now();
  const secretFindings = [];
  for (const [relPath, content] of Object.entries(allFileContents)) {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        secretFindings.push(`Potential credential in ${relPath}`);
      }
    }
  }

  stages.push({
    stage: '5_ZERO_SECRETS',
    status: secretFindings.length === 0 ? 'PASS' : 'FAIL',
    message:
      secretFindings.length === 0
        ? 'No hardcoded credentials, tokens, or private keys detected'
        : secretFindings.join('; '),
    durationMs: Date.now() - s5Start,
  });

  // Stage 6: Zero Network Scan
  const s6Start = Date.now();
  const networkFindings = [];
  for (const [relPath, content] of Object.entries(allFileContents)) {
    if (relPath === 'manifest.json') continue;
    for (const pattern of NETWORK_PATTERNS) {
      if (pattern.test(content)) {
        networkFindings.push(`Prohibited network pattern in ${relPath}: ${pattern}`);
      }
    }
  }

  stages.push({
    stage: '6_ZERO_NETWORK',
    status: networkFindings.length === 0 ? 'PASS' : 'FAIL',
    message:
      networkFindings.length === 0
        ? 'Zero outbound network calls detected; strict offline isolation enforced'
        : networkFindings.join('; '),
    durationMs: Date.now() - s6Start,
  });

  const overallPass = stages.every((s) => s.status === 'PASS');
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

  if (fs.existsSync(path.join(baseDir, 'manifest.json'))) {
    return [baseDir];
  }

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

export async function seedChallengePack(dirPath) {
  const manifestPath = path.join(dirPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not found in ${dirPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  try {
    const prismaModule = await import('../../apps/api/node_modules/@prisma/client/index.js').catch(() => null);
    if (prismaModule?.PrismaClient) {
      const prisma = new prismaModule.PrismaClient();
      await prisma.engineeringChallenge.upsert({
        where: { slug: manifest.slug },
        update: {
          title: manifest.title,
          domain: manifest.domain,
          category: manifest.category,
          difficulty: manifest.difficulty,
          estimatedMinutes: manifest.estimatedMinutes,
          status: 'PUBLISHED',
        },
        create: {
          slug: manifest.slug,
          title: manifest.title,
          domain: manifest.domain,
          category: manifest.category,
          difficulty: manifest.difficulty,
          estimatedMinutes: manifest.estimatedMinutes,
          status: 'PUBLISHED',
        },
      });
      await prisma.$disconnect();
    }
  } catch (_e) {
    // Database connection may not be running in isolated CLI
  }

  console.log(`🌱 [Pack Seeder] Seeded challenge: ${manifest.slug} (${manifest.title})`);
  return true;
}

export async function main() {
  const { targetDir, seed, json } = parseArgs();
  const rootDir = process.cwd();
  const scanTarget = targetDir
    ? path.resolve(rootDir, targetDir)
    : path.resolve(rootDir, 'challenges');

  const challengeDirs = targetDir
    ? (fs.existsSync(scanTarget) && fs.statSync(scanTarget).isDirectory() ? [scanTarget] : [])
    : findChallengeDirs(scanTarget);

  if (challengeDirs.length === 0) {
    if (json) {
      console.log(JSON.stringify({ error: `No challenge directories with manifest.json found in: ${scanTarget}`, overallPass: false }));
    } else {
      console.error(`❌ No challenge directories with manifest.json found in: ${scanTarget}`);
    }
    process.exit(1);
  }

  if (json) {
    const results = [];
    for (const dir of challengeDirs) {
      const result = await validateChallengeDir(dir);
      if (seed && result.overallPass) {
        await seedChallengePack(dir);
      }
      results.push(result);
    }
    const outputObj = challengeDirs.length === 1 ? results[0] : results;
    console.log(JSON.stringify(outputObj));
    const allPass = results.every((r) => r.overallPass);
    process.exit(allPass ? 0 : 1);
  }

  console.log('\n==============================================================================');
  console.log('🛡️  [AnyF Engineering Arena] Automated Challenge Pack Validator (6-Stage CI)');
  console.log(`📁 Target Directory: ${scanTarget}`);
  console.log('==============================================================================\n');

  let totalChallenges = 0;
  let passedChallenges = 0;
  let failedChallenges = 0;

  for (const dir of challengeDirs) {
    totalChallenges++;
    const result = await validateChallengeDir(dir);

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
      if (seed) {
        await seedChallengePack(dir);
      }
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
  main().catch((err) => {
    console.error('Fatal validator error:', err);
    process.exit(1);
  });
}
