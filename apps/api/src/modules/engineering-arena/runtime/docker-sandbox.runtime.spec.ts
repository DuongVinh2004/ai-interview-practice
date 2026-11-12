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
    expect(flags).toContain('--user');
    expect(flags).toContain('1000:1000');
    expect(flags).toContain('--memory');
    expect(flags).toContain('512m');
    expect(flags).toContain('--cpus');
    expect(flags).toContain('1');
    expect(flags).toContain('--tmpfs');
    expect(flags).toContain('/tmp:rw,noexec,nosuid,size=50m');
    expect(flags).toContain('node:22-alpine');
  });

  it('streams output chunks in real time via onLogChunk callback', async () => {
    await runtime.provision({
      sessionId: 's-docker-stream-1',
      workspaceHandle: 'ws-docker-stream-1',
      manifest: mockManifest,
      files: {
        'src/index.ts': 'export const hello = "world";',
      },
    });

    const receivedChunks: Array<{ type: string; data: string }> = [];

    const result = await runtime.runAllowedCommand({
      workspaceHandle: 'ws-docker-stream-1',
      commandId: 'test',
      manifest: mockManifest,
      onLogChunk: chunk => {
        receivedChunks.push(chunk);
      },
    });

    expect(result.exitCode).toBe(0);
    expect(receivedChunks.length).toBeGreaterThan(0);
    expect(receivedChunks.some(c => c.type === 'stdout' || c.type === 'status')).toBe(true);

    await runtime.destroy('ws-docker-stream-1');
  });

  it('enforces execution timeout and terminates timed-out execution', async () => {
    const timeoutManifest = {
      ...mockManifest,
      commands: [
        {
          id: 'infinite-loop',
          label: 'Loop',
          command: 'node -e "while(true){}"',
          args: [],
          timeoutSeconds: 1, // 1 second timeout
          isVerification: false,
        },
      ],
    };

    await runtime.provision({
      sessionId: 's-docker-timeout-1',
      workspaceHandle: 'ws-docker-timeout-1',
      manifest: timeoutManifest,
      files: {
        'src/index.ts': 'export const hello = "world";',
      },
    });

    const chunks: Array<{ type: string; data: string }> = [];
    const result = await runtime.runAllowedCommand({
      workspaceHandle: 'ws-docker-timeout-1',
      commandId: 'infinite-loop',
      manifest: timeoutManifest,
      timeoutSeconds: 1,
      onLogChunk: c => chunks.push(c),
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/timeout|timed out|killed/i);
    expect(chunks.some(c => c.data.match(/timeout|timed out|killed/i))).toBe(true);

    await runtime.destroy('ws-docker-timeout-1');
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

  describe('Security Containment Controls', () => {
    it('enforces network none, non-root uid 1000, cap-drop ALL and tmpfs noexec in docker flags', () => {
      const flags = runtime.buildDockerRunFlags({
        runtimeImage: 'node:22-alpine',
        memoryLimitMb: 512,
        cpuLimit: 1.0,
        containerName: 'arena-sbx-test-123',
      });

      // 1. Network isolation: --network none
      expect(flags).toContain('--network');
      expect(flags).toContain('none');

      // 2. Non-root execution: uid 1000
      expect(flags).toContain('--user');
      expect(flags).toContain('1000:1000');

      // 3. Drop all capabilities: --cap-drop ALL
      expect(flags).toContain('--cap-drop');
      expect(flags).toContain('ALL');

      // 4. Resource quotas: cpus 1.0, memory 512m
      expect(flags).toContain('--cpus');
      expect(flags).toContain('1');
      expect(flags).toContain('--memory');
      expect(flags).toContain('512m');

      // 5. Hardened tmpfs with noexec
      expect(flags).toContain('--tmpfs');
      const tmpfsFlag = flags[flags.indexOf('--tmpfs') + 1];
      expect(tmpfsFlag).toContain('noexec');
      expect(tmpfsFlag).toContain('nosuid');

      // 6. Container naming for SIGKILL enforcement
      expect(flags).toContain('--name');
      expect(flags).toContain('arena-sbx-test-123');
    });

    it('enforces default 15s timeout and hard kill when timeout is omitted', async () => {
      const infiniteLoopManifest = {
        ...mockManifest,
        commands: [
          {
            id: 'unbounded-loop',
            label: 'Loop',
            command: 'node -e "while(true){}"',
            args: [] as string[],
            timeoutSeconds: 15,
            isVerification: false,
          },
        ],
      };

      await runtime.provision({
        sessionId: 's-docker-default-timeout',
        workspaceHandle: 'ws-docker-default-timeout',
        manifest: infiniteLoopManifest,
        files: {
          'src/index.ts': 'export const x = 1;',
        },
      });

      const result = await runtime.runAllowedCommand({
        workspaceHandle: 'ws-docker-default-timeout',
        commandId: 'unbounded-loop',
        manifest: infiniteLoopManifest,
      });

      expect(result.exitCode).toBe(124);
      expect(result.stderr).toContain('killed with SIGKILL');
      expect(result.stderr).toContain('15s');

      await runtime.destroy('ws-docker-default-timeout');
    });

    it('respects custom memory and CPU containment ceilings', () => {
      const customFlags = runtime.buildDockerRunFlags({
        runtimeImage: 'python:3.12-alpine',
        memoryLimitMb: 256,
        cpuLimit: 0.5,
      });

      expect(customFlags).toContain('--memory');
      expect(customFlags).toContain('256m');
      expect(customFlags).toContain('--cpus');
      expect(customFlags).toContain('0.5');
      expect(customFlags).toContain('python:3.12-alpine');
    });

    it('refuses deterministic fallback and throws WorkspaceRuntimeUnavailableError in production when Docker is unavailable', async () => {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const prodRuntime = new DockerSandboxWorkspaceRuntime(undefined, false);
        jest.spyOn(prodRuntime, 'checkDockerAvailable').mockReturnValue(false);

        await expect(
          prodRuntime.provision({
            sessionId: 's-prod-fail',
            workspaceHandle: 'ws-prod-fail',
            manifest: mockManifest,
            files: { 'src/index.ts': 'export const a = 1;' },
          }),
        ).rejects.toThrow('Isolated Docker Arena runtime is unavailable');
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });
});
