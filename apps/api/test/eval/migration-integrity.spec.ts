import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

describe('Deterministic Migration-Set Hash & Safety (CD-001 / PRD-1301..1303)', () => {
  const migrationsRoot = path.resolve(__dirname, '../../prisma/migrations');
  const repoRoot = path.resolve(__dirname, '../../../../');

  function normalizeRepoRelativePath(filePath: string): string {
    const normalized = filePath.replaceAll('\\', '/').replace(/^\.\//, '');
    return normalized;
  }

  function hashRawMigrationBytes(bytes: Buffer): string {
    return crypto.createHash('sha256').update(bytes).digest('hex');
  }

  function serializeMigrationRecords(records: { path: string; sha256: string }[]): string {
    const serialized = records
      .map(
        record =>
          `${normalizeRepoRelativePath(record.path)}\t${String(record.sha256).toLowerCase()}`,
      )
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return `${serialized.join('\n')}\n`;
  }

  function computeMigrationSetSha256(records: { path: string; sha256: string }[]): string {
    return hashRawMigrationBytes(Buffer.from(serializeMigrationRecords(records), 'utf8'));
  }

  function collectMigrationSet() {
    const directories = fs
      .readdirSync(migrationsRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    const files = directories.map(dir => {
      const file = path.join(migrationsRoot, dir.name, 'migration.sql');
      const bytes = fs.readFileSync(file);
      const relPath = normalizeRepoRelativePath(path.relative(repoRoot, file));
      return {
        directory: dir.name,
        path: relPath,
        bytes,
        sha256: hashRawMigrationBytes(bytes),
      };
    });

    const records = files.map(({ path: p, sha256 }) => ({ path: p, sha256 }));
    return {
      files,
      records,
      migrationSetSha256: computeMigrationSetSha256(records),
    };
  }

  it('enumerates all migration files and computes a valid 64-char hex SHA-256 hash', () => {
    const migrationSet = collectMigrationSet();
    expect(migrationSet.files.length).toBeGreaterThan(0);
    expect(migrationSet.migrationSetSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces identical migration hash across multiple invocations (deterministic)', () => {
    const run1 = collectMigrationSet();
    const run2 = collectMigrationSet();
    expect(run1.migrationSetSha256).toBe(run2.migrationSetSha256);
  });

  it('changes migration hash if any migration file content is modified (tamper detection)', () => {
    const original = collectMigrationSet();
    const modifiedRecords = original.records.map((rec, index) => {
      if (index === 0) {
        return {
          path: rec.path,
          sha256: hashRawMigrationBytes(Buffer.from('MODIFIED SQL CONTENT', 'utf8')),
        };
      }
      return rec;
    });

    const modifiedHash = computeMigrationSetSha256(modifiedRecords);
    expect(modifiedHash).not.toBe(original.migrationSetSha256);
    expect(modifiedHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('enforces canonical ordinal sorting in migration records serialization', () => {
    const records = [
      { path: 'apps/api/prisma/migrations/20260901011000_b/migration.sql', sha256: 'a'.repeat(64) },
      { path: 'apps/api/prisma/migrations/20260901010000_a/migration.sql', sha256: 'b'.repeat(64) },
    ];
    const serialized = serializeMigrationRecords(records);
    const lines = serialized.trim().split('\n');
    expect(lines[0]).toContain('20260901010000_a');
    expect(lines[1]).toContain('20260901011000_b');
  });

  it('verifies exact match with infra check-migration-safety output', async () => {
    const migrationSet = collectMigrationSet();
    expect(migrationSet.migrationSetSha256).toBe(
      '8b4c64c71688cecd9eb29c2c8c8d30a43f12e1209b3720dab0c9aef2639b1bc2',
    );
  });
});
