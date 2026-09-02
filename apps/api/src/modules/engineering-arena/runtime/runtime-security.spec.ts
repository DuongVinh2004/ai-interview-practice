import { DockerSandboxWorkspaceRuntime } from './docker-sandbox.runtime';
import { DeterministicLocalWorkspaceRuntime } from './deterministic-local.runtime';
import { selectWorkspaceRuntime } from '../engineering-arena.module';
import { WorkspaceRuntimeUnavailableError } from './workspace-runtime.interface';

describe('Engineering Arena workspace runtime selection', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalArenaRuntime = process.env.ARENA_WORKSPACE_RUNTIME;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalArenaRuntime === undefined) delete process.env.ARENA_WORKSPACE_RUNTIME;
    else process.env.ARENA_WORKSPACE_RUNTIME = originalArenaRuntime;
  });

  it('uses deterministic runtime only when explicitly selected outside production', () => {
    process.env.NODE_ENV = 'development';
    process.env.ARENA_WORKSPACE_RUNTIME = 'deterministic';
    const deterministic = new DeterministicLocalWorkspaceRuntime();
    const docker = new DockerSandboxWorkspaceRuntime(undefined, false);

    expect(selectWorkspaceRuntime(deterministic, docker)).toBe(deterministic);
  });

  it('rejects deterministic runtime selection in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ARENA_WORKSPACE_RUNTIME = 'deterministic';

    expect(() =>
      selectWorkspaceRuntime(
        new DeterministicLocalWorkspaceRuntime(),
        new DockerSandboxWorkspaceRuntime(undefined, false),
      ),
    ).toThrow('not permitted in production');
  });

  it('fails closed instead of executing through the deterministic fallback in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ARENA_WORKSPACE_RUNTIME;
    const runtime = new DockerSandboxWorkspaceRuntime(undefined, false);

    await expect(
      runtime.provision({
        sessionId: 'session-1',
        workspaceHandle: 'ws-1',
        manifest: {} as any,
        files: {},
      }),
    ).rejects.toBeInstanceOf(WorkspaceRuntimeUnavailableError);

    await expect(
      new DeterministicLocalWorkspaceRuntime().provision({
        sessionId: 'session-2',
        workspaceHandle: 'ws-2',
        manifest: {} as any,
        files: {},
      }),
    ).rejects.toBeInstanceOf(WorkspaceRuntimeUnavailableError);
  });

  it('ignores an injected deterministic-fallback override in production', async () => {
    process.env.NODE_ENV = 'production';
    const runtime = new DockerSandboxWorkspaceRuntime(undefined, true);

    await expect(
      runtime.provision({
        sessionId: 'session-injected-bypass',
        workspaceHandle: 'ws-injected-bypass',
        manifest: {} as any,
        files: {},
      }),
    ).rejects.toBeInstanceOf(WorkspaceRuntimeUnavailableError);
  });
});
