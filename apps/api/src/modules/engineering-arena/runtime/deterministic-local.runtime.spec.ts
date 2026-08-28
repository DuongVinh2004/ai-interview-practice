import { DeterministicLocalWorkspaceRuntime } from './deterministic-local.runtime';
import { ChallengeDomain, ChallengeCategory } from '@ai-interview/contracts';

describe('DeterministicLocalWorkspaceRuntime', () => {
  let runtime: DeterministicLocalWorkspaceRuntime;

  const mockManifest = {
    schemaVersion: '1.0' as const,
    slug: 'fix-memory-leak',
    title: 'Fix Memory Leak',
    description: 'Fix leak in cache',
    domain: ChallengeDomain.BACKEND,
    category: ChallengeCategory.BUG_FIX,
    difficulty: 3,
    estimatedMinutes: 30,
    environment: {
      runtime: 'node:22',
      memoryLimitMb: 512,
      cpuLimit: 1.0,
    },
    visibleFiles: ['src/cache.ts', 'test/cache.test.ts'],
    editableFiles: ['src/cache.ts'],
    hiddenFiles: ['test/hidden.test.ts'],
    commands: [
      {
        id: 'test',
        label: 'Run Tests',
        command: 'npm test',
        args: [],
        timeoutSeconds: 15,
        isVerification: false,
      },
    ],
    rubric: { version: '1.0', objectiveWeight: 0.7, rubricWeight: 0.3, criteria: [] },
    skills: [],
  };

  beforeEach(() => {
    runtime = new DeterministicLocalWorkspaceRuntime();
  });

  it('provisions, syncs, snapshots, and destroys workspace cleanly', async () => {
    await runtime.provision({
      sessionId: 'session-1',
      workspaceHandle: 'ws-123',
      manifest: mockManifest,
      files: {
        'src/cache.ts': 'export class Cache {}',
      },
    });

    const snapshotBefore = await runtime.snapshot('ws-123');
    expect(snapshotBefore.files['src/cache.ts']).toBe('export class Cache {}');
    expect(snapshotBefore.snapshotHash).toBeDefined();

    await runtime.syncFiles('ws-123', [
      { path: 'src/cache.ts', content: 'export class FixedCache {}' },
    ]);

    const snapshotAfter = await runtime.snapshot('ws-123');
    expect(snapshotAfter.files['src/cache.ts']).toBe('export class FixedCache {}');
    expect(snapshotAfter.snapshotHash).not.toBe(snapshotBefore.snapshotHash);

    await runtime.destroy('ws-123');
    await expect(runtime.snapshot('ws-123')).rejects.toThrow('not found');
  });

  it('blocks path traversal attacks on file paths', async () => {
    await expect(
      runtime.provision({
        sessionId: 'session-1',
        workspaceHandle: 'ws-traversal',
        manifest: mockManifest,
        files: {
          '../../../etc/passwd': 'malicious',
        },
      }),
    ).rejects.toThrow('Path traversal');
  });

  it('runs allowed command and simulates test results', async () => {
    await runtime.provision({
      sessionId: 'session-1',
      workspaceHandle: 'ws-test',
      manifest: mockManifest,
      files: {
        'src/cache.ts': 'export class Cache {}',
      },
    });

    const result = await runtime.runAllowedCommand({
      workspaceHandle: 'ws-test',
      commandId: 'test',
      manifest: mockManifest,
    });

    expect(result.commandId).toBe('test');
    expect(result.exitCode).toBe(0);
    expect(result.testsPassed).toBe(1);
    expect(result.testsTotal).toBe(1);
    expect(result.testResults[0]?.passed).toBe(true);
  });

  it('rejects unallowed commands not defined in manifest', async () => {
    await runtime.provision({
      sessionId: 'session-1',
      workspaceHandle: 'ws-test',
      manifest: mockManifest,
      files: {
        'src/cache.ts': 'export class Cache {}',
      },
    });

    await expect(
      runtime.runAllowedCommand({
        workspaceHandle: 'ws-test',
        commandId: 'curl-malicious-url',
        manifest: mockManifest,
      }),
    ).rejects.toThrow('not allowed');
  });
});
