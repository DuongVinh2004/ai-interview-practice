import {
  ArenaChallengeManifest,
  ArenaTestResult,
  ArenaWorkspaceFileUpdate,
} from '@ai-interview/contracts';

// Use an explicit token so the arena cannot silently resolve the deterministic
// adapter merely because it happens to be registered in the module.
export const WORKSPACE_RUNTIME = Symbol('WORKSPACE_RUNTIME');

export class WorkspaceRuntimeUnavailableError extends Error {
  constructor(message = 'Engineering Arena workspace runtime is unavailable') {
    super(message);
    this.name = 'WorkspaceRuntimeUnavailableError';
  }
}

export interface WorkspaceProvisionParams {
  sessionId: string;
  workspaceHandle: string;
  manifest: ArenaChallengeManifest;
  files: Record<string, string>;
}

export interface WorkspaceRunCommandParams {
  workspaceHandle: string;
  commandId: string;
  manifest: ArenaChallengeManifest;
  modifiedFiles?: ArenaWorkspaceFileUpdate[];
  timeoutSeconds?: number;
}

export interface WorkspaceRunResult {
  commandId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  testsTotal: number;
  testsPassed: number;
  testsFailed: number;
  testResults: ArenaTestResult[];
  snapshotHash: string;
}

export interface WorkspaceRuntime {
  readonly name: string;
  provision(params: WorkspaceProvisionParams): Promise<void>;
  syncFiles(workspaceHandle: string, files: ArenaWorkspaceFileUpdate[]): Promise<void>;
  runAllowedCommand(params: WorkspaceRunCommandParams): Promise<WorkspaceRunResult>;
  snapshot(
    workspaceHandle: string,
  ): Promise<{ snapshotHash: string; files: Record<string, string> }>;
  destroy(workspaceHandle: string): Promise<void>;
}
