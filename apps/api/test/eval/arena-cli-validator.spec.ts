import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /sk-[a-zA-Z0-9]{32,}/,
  /BEGIN (RSA|EC|OPENSSH) PRIVATE KEY/,
  /postgres:\/\/[^:]+:[^@]+@/,
];

const VALID_RUNTIMES = ['node:22', 'node:20', 'python:3.12', 'python:3.11', 'go:1.23'];

function validateChallengeDir(dirPath: string) {
  const manifestPath = path.join(dirPath, 'manifest.json');
  const stages: { stage: string; status: 'PASS' | 'FAIL'; message: string; durationMs: number }[] =
    [];
  const start = Date.now();

  if (!fs.existsSync(manifestPath)) {
    return {
      slug: path.basename(dirPath),
      title: 'Unknown',
      overallPass: false,
      stages: [
        {
          stage: '1_SCHEMA_VALIDATION',
          status: 'FAIL' as const,
          message: `Missing manifest.json in ${dirPath}`,
          durationMs: 0,
        },
      ],
    };
  }

  let manifest: any;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(raw);
  } catch (err: any) {
    return {
      slug: path.basename(dirPath),
      title: 'Invalid JSON',
      overallPass: false,
      stages: [
        {
          stage: '1_SCHEMA_VALIDATION',
          status: 'FAIL' as const,
          message: `JSON parse error: ${err.message}`,
          durationMs: 0,
        },
      ],
    };
  }

  // 1. Schema Validation
  const s1Start = Date.now();
  const schemaErrors: string[] = [];
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

  if (manifest.rubric) {
    const totalWeight =
      (manifest.rubric.objectiveWeight || 0) + (manifest.rubric.rubricWeight || 0);
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      schemaErrors.push(`Rubric weights must sum to 1.0`);
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
  const missingVisible: string[] = [];
  const visibleContent: Record<string, string> = {};
  for (const relFile of manifest.visibleFiles || []) {
    const fullPath = path.join(dirPath, relFile);
    if (!fs.existsSync(fullPath)) {
      missingVisible.push(relFile);
    } else {
      visibleContent[relFile] = fs.readFileSync(fullPath, 'utf8');
    }
  }

  const missingHidden: string[] = [];
  const hiddenContent: Record<string, string> = {};
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
  const secretFindings: string[] = [];
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
    message: isRuntimeValid ? `Supported runtime: ${runtime}` : `Unsupported runtime '${runtime}'`,
    durationMs: Date.now() - s4Start,
  });

  // 5. Candidate Artifact Separation
  const s5Start = Date.now();
  const leakedHidden = (manifest.hiddenFiles || []).filter((h: string) => h in visibleContent);
  stages.push({
    stage: '5_CANDIDATE_ARTIFACT_SEPARATION',
    status: leakedHidden.length === 0 ? 'PASS' : 'FAIL',
    message:
      leakedHidden.length === 0
        ? 'Hidden verification tests strictly isolated'
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

describe('Arena Challenge Packs & CLI Validator', () => {
  const repoRoot = path.resolve(__dirname, '../../../../');
  const challengesDir = path.join(repoRoot, 'challenges');

  it('finds all 5 benchmark challenge pack directories in challenges/', () => {
    const entries = fs.readdirSync(challengesDir, { withFileTypes: true });
    const packs = entries.filter(e => e.isDirectory() && e.name.startsWith('pack-'));
    expect(packs.length).toBe(5);
  });

  it('validates that all 5 challenge packs pass 100% across all 6 stages', () => {
    const entries = fs.readdirSync(challengesDir, { withFileTypes: true });
    const packs = entries.filter(e => e.isDirectory() && e.name.startsWith('pack-'));

    for (const pack of packs) {
      const packDir = path.join(challengesDir, pack.name);
      const result = validateChallengeDir(packDir);
      expect(result.overallPass).toBe(true);
      expect(result.stages).toHaveLength(6);
      expect(result.stages.every(s => s.status === 'PASS')).toBe(true);
    }
  });

  it('executes arena-validate CLI script via Node and passes with exit code 0', () => {
    const scriptPath = path.join(repoRoot, 'infra/scripts/arena-validate.mjs');
    const output = execSync(`node "${scriptPath}"`, { cwd: repoRoot, encoding: 'utf8' });

    expect(output).toContain('Automated Challenge Pack Validator');
    expect(output).toContain('Passed: 5 ✅ | Failed: 0 ❌');
  });

  it('executes arena-validate CLI script for a single challenge directory', () => {
    const scriptPath = path.join(repoRoot, 'infra/scripts/arena-validate.mjs');
    const singlePack = path.join(repoRoot, 'challenges/pack-001-profile-bola');
    const output = execSync(`node "${scriptPath}" --dir "${singlePack}"`, {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('fix-user-profile-bola');
    expect(output).toContain('Passed: 1 ✅ | Failed: 0 ❌');
  });

  describe('Negative Security & Integrity Tests', () => {
    const tmpDir = path.resolve(__dirname, 'tmp-test-pack');

    beforeEach(() => {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('fails when manifest.json is missing', () => {
      const result = validateChallengeDir(tmpDir);
      expect(result.overallPass).toBe(false);
      expect(result.stages[0]?.status).toBe('FAIL');
    });

    it('fails when manifest.json contains invalid JSON syntax', () => {
      fs.writeFileSync(path.join(tmpDir, 'manifest.json'), '{ broken json ');
      const result = validateChallengeDir(tmpDir);
      expect(result.overallPass).toBe(false);
      expect(result.stages[0]?.status).toBe('FAIL');
    });

    it('fails Stage 2 (SOURCE_INTEGRITY) when declared visible file does not exist on disk', () => {
      const manifest = {
        schemaVersion: '1.0',
        slug: 'test-missing-file',
        title: 'Test Missing File',
        domain: 'BACKEND',
        category: 'BUG_FIX',
        difficulty: 3,
        environment: { runtime: 'node:22' },
        visibleFiles: ['src/missing.ts'],
        hiddenFiles: [],
        commands: [
          {
            id: 'test',
            label: 'Test',
            command: 'npm test',
            args: [],
            timeoutSeconds: 15,
            isVerification: false,
          },
        ],
        rubric: { version: '1.0', objectiveWeight: 0.5, rubricWeight: 0.5, criteria: [] },
        skills: [{ taxonomyKey: 'test_skill', weight: 1.0 }],
      };
      fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify(manifest));

      const result = validateChallengeDir(tmpDir);
      expect(result.overallPass).toBe(false);
      const stage2 = result.stages.find(s => s.stage === '2_SOURCE_INTEGRITY');
      expect(stage2?.status).toBe('FAIL');
      expect(stage2?.message).toContain('Missing visible: src/missing.ts');
    });

    it('fails Stage 3 (SECRETS_SCAN) when file contains hardcoded AWS access key', () => {
      const manifest = {
        schemaVersion: '1.0',
        slug: 'test-secret-leak',
        title: 'Test Secret Leak',
        domain: 'SECURITY',
        category: 'BUG_FIX',
        difficulty: 3,
        environment: { runtime: 'node:22' },
        visibleFiles: ['src/app.ts'],
        hiddenFiles: [],
        commands: [
          {
            id: 'test',
            label: 'Test',
            command: 'npm test',
            args: [],
            timeoutSeconds: 15,
            isVerification: false,
          },
        ],
        rubric: { version: '1.0', objectiveWeight: 0.5, rubricWeight: 0.5, criteria: [] },
        skills: [{ taxonomyKey: 'test_skill', weight: 1.0 }],
      };
      fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify(manifest));
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src/app.ts'), 'const key = "AKIA1111222233334444";');

      const result = validateChallengeDir(tmpDir);
      expect(result.overallPass).toBe(false);
      const stage3 = result.stages.find(s => s.stage === '3_SECRETS_SCAN');
      expect(stage3?.status).toBe('FAIL');
      expect(stage3?.message).toContain('Potential credential');
    });

    it('fails Stage 4 (RUNTIME_IMAGE_CHECK) when runtime is unsupported', () => {
      const manifest = {
        schemaVersion: '1.0',
        slug: 'test-unsupported-runtime',
        title: 'Test Unsupported Runtime',
        domain: 'BACKEND',
        category: 'BUG_FIX',
        difficulty: 3,
        environment: { runtime: 'ruby:3.2' },
        visibleFiles: [],
        hiddenFiles: [],
        commands: [
          {
            id: 'test',
            label: 'Test',
            command: 'npm test',
            args: [],
            timeoutSeconds: 15,
            isVerification: false,
          },
        ],
        rubric: { version: '1.0', objectiveWeight: 0.5, rubricWeight: 0.5, criteria: [] },
        skills: [{ taxonomyKey: 'test_skill', weight: 1.0 }],
      };
      fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify(manifest));

      const result = validateChallengeDir(tmpDir);
      expect(result.overallPass).toBe(false);
      const stage4 = result.stages.find(s => s.stage === '4_RUNTIME_IMAGE_CHECK');
      expect(stage4?.status).toBe('FAIL');
      expect(stage4?.message).toContain("Unsupported runtime 'ruby:3.2'");
    });

    it('fails Stage 5 (CANDIDATE_ARTIFACT_SEPARATION) when hidden test file is present in visible bundle', () => {
      const manifest = {
        schemaVersion: '1.0',
        slug: 'test-hidden-leak',
        title: 'Test Hidden Leak',
        domain: 'BACKEND',
        category: 'BUG_FIX',
        difficulty: 3,
        environment: { runtime: 'node:22' },
        visibleFiles: ['test/hidden.test.ts'],
        hiddenFiles: ['test/hidden.test.ts'],
        commands: [
          {
            id: 'test',
            label: 'Test',
            command: 'npm test',
            args: [],
            timeoutSeconds: 15,
            isVerification: false,
          },
        ],
        rubric: { version: '1.0', objectiveWeight: 0.5, rubricWeight: 0.5, criteria: [] },
        skills: [{ taxonomyKey: 'test_skill', weight: 1.0 }],
      };
      fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify(manifest));
      fs.mkdirSync(path.join(tmpDir, 'test'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'test/hidden.test.ts'), 'test("hidden", () => {})');

      const result = validateChallengeDir(tmpDir);
      expect(result.overallPass).toBe(false);
      const stage5 = result.stages.find(s => s.stage === '5_CANDIDATE_ARTIFACT_SEPARATION');
      expect(stage5?.status).toBe('FAIL');
      expect(stage5?.message).toContain('Hidden files leaked: test/hidden.test.ts');
    });
  });
});
