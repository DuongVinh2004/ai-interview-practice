import { Injectable, Logger } from '@nestjs/common';
import {
  WorkspaceRuntime,
  WorkspaceProvisionParams,
  WorkspaceRunCommandParams,
  WorkspaceRunResult,
} from './workspace-runtime.interface';
import { ArenaWorkspaceFileUpdate, ArenaTestResult } from '@ai-interview/contracts';
import * as crypto from 'crypto';

interface ActiveWorkspace {
  sessionId: string;
  files: Map<string, string>;
  createdAt: Date;
}

@Injectable()
export class DeterministicLocalWorkspaceRuntime implements WorkspaceRuntime {
  readonly name = 'DETERMINISTIC_LOCAL_ADAPTER';
  private readonly logger = new Logger(DeterministicLocalWorkspaceRuntime.name);
  private readonly workspaces = new Map<string, ActiveWorkspace>();

  async provision(params: WorkspaceProvisionParams): Promise<void> {
    const fileMap = new Map<string, string>();
    for (const [path, content] of Object.entries(params.files)) {
      this.validatePath(path);
      fileMap.set(path, content);
    }

    this.workspaces.set(params.workspaceHandle, {
      sessionId: params.sessionId,
      files: fileMap,
      createdAt: new Date(),
    });
    this.logger.log(`Provisioned workspace ${params.workspaceHandle} with ${fileMap.size} files`);
  }

  async syncFiles(workspaceHandle: string, files: ArenaWorkspaceFileUpdate[]): Promise<void> {
    const ws = this.getWorkspace(workspaceHandle);
    for (const file of files) {
      this.validatePath(file.path);
      ws.files.set(file.path, file.content);
    }
  }

  async runAllowedCommand(params: WorkspaceRunCommandParams): Promise<WorkspaceRunResult> {
    const ws = this.getWorkspace(params.workspaceHandle);

    // Apply any in-flight modified files
    if (params.modifiedFiles && params.modifiedFiles.length > 0) {
      await this.syncFiles(params.workspaceHandle, params.modifiedFiles);
    }

    // Lookup command from manifest allowlist
    const cmdDef = params.manifest.commands.find(c => c.id === params.commandId);
    if (!cmdDef) {
      throw new Error(`Command '${params.commandId}' is not allowed by challenge manifest.`);
    }

    const startTime = Date.now();
    const snapshotHash = this.computeSnapshotHash(ws.files);

    // Deterministic simulation based on file contents
    const testResults: ArenaTestResult[] = [];
    let testsPassed = 0;
    let testsFailed = 0;
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    // Check if files contain common mock bug keywords or fixes
    let hasFix = true;
    for (const [_, content] of ws.files.entries()) {
      if (content.includes('TODO: fix') || content.includes('throw new Error("Not implemented")')) {
        hasFix = false;
        break;
      }
    }

    const testCommand = cmdDef.id === 'test' || cmdDef.isVerification;
    if (testCommand) {
      const suiteName = `${params.manifest.slug}.spec.ts`;
      if (hasFix) {
        testResults.push({
          suiteName,
          testName: 'should pass unit tests',
          passed: true,
          durationMs: 45,
        });
        testsPassed = 1;
        stdout = `PASS ${suiteName}\n  √ should pass unit tests (45 ms)\n\nTest Suites: 1 passed, 1 total\nTests: 1 passed, 1 total\n`;
      } else {
        testResults.push({
          suiteName,
          testName: 'should pass unit tests',
          passed: false,
          durationMs: 30,
          errorMsg: 'AssertionError: Expected true to be false',
        });
        testsFailed = 1;
        exitCode = 1;
        stdout = `FAIL ${suiteName}\n  × should pass unit tests (30 ms)\n\nTest Suites: 1 failed, 1 total\nTests: 1 failed, 1 total\n`;
        stderr = 'Error: Test assertions failed\n';
      }
    } else {
      stdout = `Executed command: ${cmdDef.command} ${cmdDef.args.join(' ')}\nDone.\n`;
    }

    const durationMs = Date.now() - startTime;

    return {
      commandId: cmdDef.id,
      exitCode,
      stdout,
      stderr,
      durationMs,
      testsTotal: testsPassed + testsFailed,
      testsPassed,
      testsFailed,
      testResults,
      snapshotHash,
    };
  }

  async snapshot(
    workspaceHandle: string,
  ): Promise<{ snapshotHash: string; files: Record<string, string> }> {
    const ws = this.getWorkspace(workspaceHandle);
    const files: Record<string, string> = {};
    for (const [p, c] of ws.files.entries()) {
      files[p] = c;
    }
    const snapshotHash = this.computeSnapshotHash(ws.files);
    return { snapshotHash, files };
  }

  async destroy(workspaceHandle: string): Promise<void> {
    this.workspaces.delete(workspaceHandle);
    this.logger.log(`Destroyed workspace ${workspaceHandle}`);
  }

  private getWorkspace(handle: string): ActiveWorkspace {
    const ws = this.workspaces.get(handle);
    if (!ws) {
      throw new Error(`Workspace '${handle}' not found or has been destroyed.`);
    }
    return ws;
  }

  private validatePath(filePath: string): void {
    if (filePath.includes('..') || filePath.startsWith('/') || filePath.startsWith('\\')) {
      throw new Error(`Security violation: Path traversal detected in '${filePath}'.`);
    }
  }

  private computeSnapshotHash(files: Map<string, string>): string {
    const sortedKeys = Array.from(files.keys()).sort();
    const hash = crypto.createHash('sha256');
    for (const k of sortedKeys) {
      hash.update(k);
      hash.update(files.get(k) || '');
    }
    return hash.digest('hex');
  }
}
