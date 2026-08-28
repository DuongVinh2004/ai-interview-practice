import { DockerSandboxWorkspaceRuntime } from './docker-sandbox.runtime';
import { ChallengeDomain, ChallengeCategory } from '@ai-interview/contracts';

describe('DockerSandboxWorkspaceRuntime (Stage B Hardened Container)', () => {
  let runtime: DockerSandboxWorkspaceRuntime;

  const mockManifest = {
    schemaVersion: '1.0' as const,
    slug: 'container-test',
    title: 'Container Test',
    description: 'Test container flags',
    domain: ChallengeDomain.BACKEND,
    category: ChallengeCategory.BUG_FIX,
    difficulty: 3,
    estimatedMinutes: 30,
    environment: {
      runtime: 'node:22',
      memoryLimitMb: 512,
      cpuLimit: 1.0,
    },
    visibleFiles: ['src/index.ts'],
    editableFiles: ['src/index.ts'],
    hiddenFiles: ['test/hidden.test.ts'],
    commands: [
      {
        id: 'test',
        label: 'Run',
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
    runtime = new DockerSandboxWorkspaceRuntime();
  });

  it('builds hardened Docker run flags enforcing all security controls', () => {
    const flags = runtime.buildDockerRunFlags({
      runtimeImage: 'node:22-alpine',
      memoryLimitMb: 512,
      cpuLimit: 1.0,
      timeoutSeconds: 15,
    });

    expect(flags).toContain('--network');
    expect(flags).toContain('none');
    expect(flags).toContain('--read-only');
    expect(flags).toContain('--cap-drop');
    expect(flags).toContain('ALL');
    expect(flags).toContain('no-new-privileges');
    expect(flags).toContain('1000:1000');
    expect(flags).toContain('512m');
    expect(flags).toContain('node:22-alpine');
  });

  it('provisions and runs commands through secure container adapter', async () => {
    await runtime.provision({
      sessionId: 's-docker-1',
      workspaceHandle: 'ws-docker-1',
      manifest: mockManifest,
      files: {
        'src/index.ts': 'export const hello = "world";',
      },
    });

    const result = await runtime.runAllowedCommand({
      workspaceHandle: 'ws-docker-1',
      commandId: 'test',
      manifest: mockManifest,
    });

    expect(result.commandId).toBe('test');
    expect(result.exitCode).toBe(0);
    expect(result.testsPassed).toBe(1);

    await runtime.destroy('ws-docker-1');
  });

  it('rejects path traversal attacks before container mount', async () => {
    await expect(
      runtime.provision({
        sessionId: 's-docker-bad',
        workspaceHandle: 'ws-docker-bad',
        manifest: mockManifest,
        files: {
          '../../etc/shadow': 'attack',
        },
      }),
    ).rejects.toThrow('Path traversal');
  });
});
