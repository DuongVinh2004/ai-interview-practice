import { ArenaPatchExporterService } from './arena-patch-exporter.service';

describe('ArenaPatchExporterService', () => {
  let service: ArenaPatchExporterService;

  beforeEach(() => {
    service = new ArenaPatchExporterService();
  });

  it('generates standard git unified patch and diff statistics', () => {
    const initialFiles = {
      'src/cache.ts': 'export class Cache {\n  get() {}\n}',
    };

    const finalFiles = {
      'src/cache.ts': 'export class Cache {\n  get() {}\n  set() {}\n}',
      'src/utils.ts': 'export const helper = true;',
    };

    const result = service.generateUnifiedPatch(initialFiles, finalFiles);

    expect(result.stats.filesChanged).toBe(2);
    expect(result.stats.additions).toBeGreaterThanOrEqual(2);
    expect(result.patch).toContain('diff --git a/src/cache.ts b/src/cache.ts');
    expect(result.patch).toContain('diff --git a/src/utils.ts b/src/utils.ts');
    expect(result.patch).toContain('+export const helper = true;');
  });

  it('returns empty patch when no files changed', () => {
    const files = { 'src/index.ts': 'const a = 1;' };
    const result = service.generateUnifiedPatch(files, files);

    expect(result.stats.filesChanged).toBe(0);
    expect(result.stats.additions).toBe(0);
    expect(result.stats.deletions).toBe(0);
    expect(result.patch).toBe('');
  });
});
