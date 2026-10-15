import { DeterministicLocalWorkspaceRuntime } from '../deterministic-local.runtime';
import { DockerSandboxWorkspaceRuntime } from '../docker-sandbox.runtime';

describe('Arena Path Traversal Hardening', () => {
  let localRuntime: DeterministicLocalWorkspaceRuntime;
  let dockerRuntime: DockerSandboxWorkspaceRuntime;

  beforeEach(() => {
    localRuntime = new DeterministicLocalWorkspaceRuntime();
    dockerRuntime = new DockerSandboxWorkspaceRuntime();
  });

  const maliciousPaths = [
    '../etc/passwd',
    '..\\windows\\system32',
    '%2e%2e%2fsecret.key',
    '%2e%2e/config.json',
    'safe.ts\0../../etc/shadow',
    'C:\\Windows\\System32\\cmd.exe',
    'd:/secret.env',
    'nested/../../outer.ts',
    '/root/.ssh/id_rsa',
    '\\etc\\passwd',
  ];

  it.each(maliciousPaths)('DeterministicLocalWorkspaceRuntime rejects malicious path "%s"', async path => {
    await expect(
      localRuntime.provision({
        sessionId: 'test-session',
        workspaceHandle: 'ws-test',
        files: { [path]: 'malicious content' },
        manifest: {} as any,
      }),
    ).rejects.toThrow(/Security violation/);
  });

  it.each(maliciousPaths)('DockerSandboxWorkspaceRuntime rejects malicious path "%s"', async path => {
    await expect(
      dockerRuntime.provision({
        sessionId: 'test-session',
        workspaceHandle: 'ws-test',
        files: { [path]: 'malicious content' },
        manifest: {} as any,
      }),
    ).rejects.toThrow(/Security violation/);
  });
});
