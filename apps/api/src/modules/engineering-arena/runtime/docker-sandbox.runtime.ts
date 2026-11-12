import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  WorkspaceRuntime,
  WorkspaceProvisionParams,
  WorkspaceRunCommandParams,
  WorkspaceRunResult,
  WorkspaceRuntimeUnavailableError,
} from './workspace-runtime.interface';
import { DeterministicLocalWorkspaceRuntime } from './deterministic-local.runtime';
import { ArenaWorkspaceFileUpdate } from '@ai-interview/contracts';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn, spawnSync } from 'child_process';
import { assertSafeWorkspacePath } from './workspace-path.util';

@Injectable()
export class DockerSandboxWorkspaceRuntime implements WorkspaceRuntime {
  readonly name = 'DOCKER_STAGE_B_CONTAINER_ADAPTER';
  private readonly logger = new Logger(DockerSandboxWorkspaceRuntime.name);

  // Injected fallback adapter for environments without Docker daemon (CI/Windows dev)
  private readonly fallbackAdapter: DeterministicLocalWorkspaceRuntime;
  private readonly allowDeterministicFallback: boolean;
  private isDockerAvailable = false;

  constructor(
    fallbackAdapter?: DeterministicLocalWorkspaceRuntime,
    @Optional()
    @Inject('ARENA_DETERMINISTIC_FALLBACK')
    allowDeterministicFallback?: boolean,
  ) {
    this.fallbackAdapter = fallbackAdapter || new DeterministicLocalWorkspaceRuntime();
    const environment = (process.env.NODE_ENV || process.env.APP_ENV || '').trim().toLowerCase();
    const envFallback =
      (process.env.ARENA_DETERMINISTIC_FALLBACK || '').trim().toLowerCase() === 'true';
    this.allowDeterministicFallback =
      environment !== 'production' &&
      (allowDeterministicFallback ?? (envFallback || environment === 'test'));
  }

  /**
   * Checks whether the Docker engine is running and reachable
   */
  public checkDockerAvailable(): boolean {
    if (this.isDockerAvailable) return true;
    try {
      const res = spawnSync('docker', ['info'], { timeout: 2000, stdio: 'pipe' });
      this.isDockerAvailable = res.status === 0;
    } catch {
      this.isDockerAvailable = false;
    }
    return this.isDockerAvailable;
  }

  /**
   * Builds the hardened Docker command line arguments according to security specs
   */
  public buildDockerRunFlags(params: {
    runtimeImage: string;
    memoryLimitMb?: number;
    cpuLimit?: number;
    timeoutSeconds?: number;
    containerName?: string;
  }): string[] {
    const memoryMb = params.memoryLimitMb ?? 512;
    const cpus = params.cpuLimit ?? 1.0;

    const flags = [
      'run',
      '--rm',
      '--network',
      'none', // No external network access
      '--read-only', // Read-only root filesystem
      '--cap-drop',
      'ALL', // Drop all Linux capabilities
      '--security-opt',
      'no-new-privileges', // Prevent privilege escalation
      '--user',
      '1000:1000', // Non-root user (uid 1000)
      '--memory',
      `${memoryMb}m`, // Memory ceiling
      '--cpus',
      `${cpus}`, // CPU quota
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,size=50m', // Restricted tmpfs for test execution
    ];

    if (params.containerName) {
      flags.push('--name', params.containerName);
    }

    flags.push(params.runtimeImage);
    return flags;
  }

  async provision(params: WorkspaceProvisionParams): Promise<void> {
    this.assertRuntimeAvailable();
    // Validate paths
    for (const filePath of Object.keys(params.files)) {
      assertSafeWorkspacePath(filePath);
    }

    this.logger.log(`Provisioning container workspace for session ${params.sessionId}`);
    // Delegate to local storage/fallback runtime for virtualized container mounting
    await this.fallbackAdapter.provision(params);
  }

  async syncFiles(workspaceHandle: string, files: ArenaWorkspaceFileUpdate[]): Promise<void> {
    this.assertRuntimeAvailable();
    await this.fallbackAdapter.syncFiles(workspaceHandle, files);
  }

  async runAllowedCommand(params: WorkspaceRunCommandParams): Promise<WorkspaceRunResult> {
    const cmdDef = params.manifest.commands.find(c => c.id === params.commandId);
    if (!cmdDef) {
      throw new Error(`Command '${params.commandId}' is not allowed by challenge manifest.`);
    }

    this.assertRuntimeAvailable();

    this.logger.log(
      `Executing command '${params.commandId}' in container sandbox for ${params.workspaceHandle}`,
    );

    if (params.onLogChunk) {
      params.onLogChunk({
        type: 'status',
        data: `[ContainerSandbox] Initializing isolated Stage B container for '${cmdDef.id}'...`,
      });
    }

    if (this.checkDockerAvailable()) {
      return this.executeDockerContainer(params, cmdDef);
    }

    // Run using deterministic adapter for tests/environments without Docker daemon
    return this.fallbackAdapter.runAllowedCommand(params);
  }

  private async executeDockerContainer(
    params: WorkspaceRunCommandParams,
    cmdDef: { id: string; command: string; args: string[]; timeoutSeconds?: number },
  ): Promise<WorkspaceRunResult> {
    const startTime = Date.now();
    const timeoutSec = params.timeoutSeconds ?? cmdDef.timeoutSeconds ?? 15;
    const timeoutMs = timeoutSec * 1000;

    // Snapshot existing files to host workspace mount directory
    const snapshot = await this.fallbackAdapter.snapshot(params.workspaceHandle);
    const hostDir = path.join(os.tmpdir(), 'arena-sandboxes', params.workspaceHandle);
    fs.mkdirSync(hostDir, { recursive: true });

    for (const [filePath, content] of Object.entries(snapshot.files)) {
      const fullPath = path.join(hostDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
    }

    const runtimeImage = params.manifest.environment?.runtime || 'node:22-alpine';
    const containerName = `arena-sbx-${params.workspaceHandle}-${Date.now()}`;
    const dockerFlags = this.buildDockerRunFlags({
      runtimeImage,
      memoryLimitMb: params.manifest.environment?.memoryLimitMb ?? 512,
      cpuLimit: params.manifest.environment?.cpuLimit ?? 1.0,
      timeoutSeconds: timeoutSec,
      containerName,
    });

    const imageIndex = dockerFlags.indexOf(runtimeImage);
    const runArgs = [
      ...dockerFlags.slice(0, imageIndex),
      '-v',
      `${hostDir}:/workspace:rw`,
      '--workdir',
      '/workspace',
      runtimeImage,
      'sh',
      '-c',
      `${cmdDef.command} ${cmdDef.args.join(' ')}`,
    ];

    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    let timedOut = false;

    await new Promise<void>(resolve => {
      const child = spawn('docker', runArgs, {
        detached: process.platform !== 'win32',
      });

      const timer = setTimeout(() => {
        timedOut = true;
        this.logger.warn(`Execution timed out after ${timeoutSec}s. Killing container process...`);
        try {
          spawnSync('docker', ['kill', containerName], { timeout: 3000, stdio: 'pipe' });
        } catch {
          // Process might already be dead
        }
        try {
          if (process.platform !== 'win32' && child.pid) {
            process.kill(-child.pid, 'SIGKILL');
          } else if (child.pid) {
            child.kill('SIGKILL');
          }
        } catch {
          // Process might already be dead
        }
      }, timeoutMs);

      child.stdout?.on('data', chunk => {
        const text = chunk.toString();
        stdout += text;
        params.onLogChunk?.({ type: 'stdout', data: text });
      });

      child.stderr?.on('data', chunk => {
        const text = chunk.toString();
        stderr += text;
        params.onLogChunk?.({ type: 'stderr', data: text });
      });

      child.on('close', code => {
        clearTimeout(timer);
        exitCode = timedOut ? 124 : (code ?? 0);
        if (timedOut) {
          const timeoutMsg = `Command execution timed out after ${timeoutSec}s (killed with SIGKILL)`;
          stderr += (stderr ? '\n' : '') + timeoutMsg;
          params.onLogChunk?.({ type: 'stderr', data: timeoutMsg });
        }
        resolve();
      });

      child.on('error', err => {
        clearTimeout(timer);
        stderr += `\nFailed to start docker process: ${err.message}`;
        exitCode = 1;
        resolve();
      });
    });

    const durationMs = Date.now() - startTime;
    const isSuccess = exitCode === 0;

    return {
      commandId: cmdDef.id,
      exitCode,
      stdout,
      stderr,
      durationMs,
      testsTotal: isSuccess ? 1 : 0,
      testsPassed: isSuccess ? 1 : 0,
      testsFailed: isSuccess ? 0 : 1,
      testResults: [
        {
          suiteName: `${params.manifest.slug}.spec.ts`,
          testName: cmdDef.id,
          passed: isSuccess,
          durationMs,
          errorMsg: isSuccess ? undefined : stderr || 'Execution failed',
        },
      ],
      snapshotHash: snapshot.snapshotHash,
    };
  }

  async snapshot(
    workspaceHandle: string,
  ): Promise<{ snapshotHash: string; files: Record<string, string> }> {
    this.assertRuntimeAvailable();
    return this.fallbackAdapter.snapshot(workspaceHandle);
  }

  async destroy(workspaceHandle: string): Promise<void> {
    this.assertRuntimeAvailable();
    await this.fallbackAdapter.destroy(workspaceHandle);
    this.logger.log(`Destroyed container workspace ${workspaceHandle}`);
  }

  private assertRuntimeAvailable(): void {
    if (this.checkDockerAvailable() || this.allowDeterministicFallback) {
      return;
    }

    throw new WorkspaceRuntimeUnavailableError(
      'Isolated Docker Arena runtime is unavailable; refusing to execute with a deterministic adapter.',
    );
  }
}
