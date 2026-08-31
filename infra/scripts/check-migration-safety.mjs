import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const migrationsRoot = resolve(repositoryRoot, 'apps/api/prisma/migrations');
const approvedMarker = /migration-safety:\s*(expand|backfilled|contract-approved)/i;
const forbidden = [
  { name: 'DROP TABLE', pattern: /\bDROP\s+TABLE\b/i },
  { name: 'DROP COLUMN', pattern: /\bDROP\s+COLUMN\b/i },
  { name: 'DROP TYPE', pattern: /\bDROP\s+TYPE\b/i },
  { name: 'ALTER COLUMN TYPE', pattern: /\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i },
  { name: 'SET NOT NULL', pattern: /\bALTER\s+COLUMN\b[^;]*\bSET\s+NOT\s+NULL\b/i },
];

const defaultFs = { readdirSync, readFileSync, statSync };

function ordinalCompare(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function normalizeRepoRelativePath(path) {
  const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '');
  if (
    normalized.length === 0 ||
    normalized.startsWith('/') ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.includes('\n') ||
    normalized.includes('\r') ||
    normalized.includes('\t')
  ) {
    throw new Error(`Invalid migration path for hashing: ${path}`);
  }
  return normalized;
}

export function hashRawMigrationBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function serializeMigrationRecords(records) {
  const serialized = records
    .map(record => {
      const path = normalizeRepoRelativePath(record.path);
      const sha256 = String(record.sha256).toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(sha256)) {
        throw new Error(`Invalid migration SHA-256 for ${path}`);
      }
      return `${path}\t${sha256}`;
    })
    .sort(ordinalCompare);

  return `${serialized.join('\n')}\n`;
}

export function computeMigrationSetSha256(records) {
  return hashRawMigrationBytes(Buffer.from(serializeMigrationRecords(records), 'utf8'));
}

export function enumerateMigrationFiles(
  root = migrationsRoot,
  repoRoot = repositoryRoot,
  fsApi = defaultFs,
) {
  const directories = fsApi
    .readdirSync(root, { withFileTypes: true })
    .filter(directory => directory.isDirectory())
    .sort((left, right) => ordinalCompare(left.name, right.name));

  return directories.map(directory => {
    const file = join(root, directory.name, 'migration.sql');
    let fileStat;
    try {
      fileStat = fsApi.statSync(file);
    } catch {
      throw new Error(`Missing migration.sql: ${directory.name}/migration.sql`);
    }
    if (!fileStat.isFile()) {
      throw new Error(`Missing migration.sql: ${directory.name}/migration.sql`);
    }

    const bytes = fsApi.readFileSync(file);
    const path = normalizeRepoRelativePath(relative(repoRoot, file));
    return {
      directory: directory.name,
      file,
      path,
      bytes,
      sha256: hashRawMigrationBytes(bytes),
    };
  });
}

export function collectMigrationSet(
  root = migrationsRoot,
  repoRoot = repositoryRoot,
  fsApi = defaultFs,
) {
  const files = enumerateMigrationFiles(root, repoRoot, fsApi);
  const records = files.map(({ path, sha256 }) => ({ path, sha256 }));
  return {
    files,
    records,
    migrationSetSha256: computeMigrationSetSha256(records),
  };
}

export function findMigrationSafetyFailures(files) {
  const failures = [];
  for (const file of files) {
    const sql = file.bytes.toString('utf8');
    const statements = sql.split(';');
    let offset = 0;
    for (const statement of statements) {
      const statementStart = offset;
      const line = sql.slice(0, offset).split('\n').length;
      offset += statement.length + 1;
      const risk = forbidden.find(rule => rule.pattern.test(statement));
      if (!risk) continue;

      const context = sql.slice(Math.max(0, statementStart - 300), offset);
      if (!approvedMarker.test(context)) {
        failures.push(`${file.path}:${line}: ${risk.name} requires a migration-safety annotation`);
      }
    }
  }
  return failures;
}

export function runMigrationSafetyGate(options = {}) {
  const migrationSet = collectMigrationSet(
    options.root ?? migrationsRoot,
    options.repoRoot ?? repositoryRoot,
    options.fsApi ?? defaultFs,
  );
  const failures = findMigrationSafetyFailures(migrationSet.files);
  if (failures.length > 0) {
    throw new Error(
      [
        'Unsafe or unreviewed migration operations detected:',
        ...failures.map(failure => `- ${failure}`),
      ].join('\n'),
    );
  }
  return migrationSet;
}

function main() {
  const migrationSet = runMigrationSafetyGate();
  if (process.argv.includes('--print-migration-set-sha256')) {
    console.log(migrationSet.migrationSetSha256);
    return;
  }
  console.log('Migration safety gate passed: no unreviewed destructive/contract operations.');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
