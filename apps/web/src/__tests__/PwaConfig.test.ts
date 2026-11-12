import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('PWA Frontend Configuration (apps/web/vite.config.ts)', () => {
  const viteConfigPath = path.resolve(__dirname, '../../vite.config.ts');
  const viteConfigFile = fs.readFileSync(viteConfigPath, 'utf-8');

  it('imports and registers VitePWA plugin', () => {
    expect(viteConfigFile).toContain("import { VitePWA } from 'vite-plugin-pwa'");
    expect(viteConfigFile).toContain('VitePWA({');
  });

  it('configures PWA manifest with required metadata', () => {
    expect(viteConfigFile).toMatch(/name:\s*['"]AI Interview Practice['"]/);
    expect(viteConfigFile).toMatch(/short_name:\s*['"]AI Interview['"]/);
    expect(viteConfigFile).toMatch(/theme_color:\s*['"]#059669['"]/);
    expect(viteConfigFile).toMatch(/display:\s*['"]standalone['"]/);
  });

  it('configures Workbox NetworkFirst cache for flashcard API', () => {
    expect(viteConfigFile).toContain('api-flashcards-cache');
    expect(viteConfigFile).toContain('NetworkFirst');
    expect(viteConfigFile).toMatch(/urlPattern:\s*\/\\\/api\\\/flashcards\.\*\/i/);
  });
});
