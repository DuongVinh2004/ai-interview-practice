export interface MigrationFileRecord {
  directory: string;
  file: string;
  path: string;
  bytes: Buffer;
  sha256: string;
}

export interface MigrationRecord {
  path: string;
  sha256: string;
}

export interface MigrationSetResult {
  files: MigrationFileRecord[];
  records: MigrationRecord[];
  migrationSetSha256: string;
}

export function normalizeRepoRelativePath(path: string): string;
export function hashRawMigrationBytes(bytes: Buffer): string;
export function serializeMigrationRecords(records: MigrationRecord[]): string;
export function computeMigrationSetSha256(records: MigrationRecord[]): string;
export function enumerateMigrationFiles(
  root?: string,
  repoRoot?: string,
  fsApi?: any,
): MigrationFileRecord[];
export function collectMigrationSet(
  root?: string,
  repoRoot?: string,
  fsApi?: any,
): MigrationSetResult;
export function findMigrationSafetyFailures(files: MigrationFileRecord[]): string[];
export function runMigrationSafetyGate(options?: any): MigrationSetResult;
