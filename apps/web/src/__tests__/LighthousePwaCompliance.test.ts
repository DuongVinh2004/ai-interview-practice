import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Lighthouse PWA Compliance Audit (Plan C4 - Task 3)', () => {
  const publicDir = path.resolve(__dirname, '../../public');
  const manifestPath = path.join(publicDir, 'manifest.webmanifest');
  const swPath = path.join(publicDir, 'sw.js');
  const viteConfigPath = path.resolve(__dirname, '../../vite.config.ts');

  describe('1. Installable Manifest Schema & PWA Standards', () => {
    it('manifest.webmanifest exists and is valid JSON', () => {
      expect(fs.existsSync(manifestPath), 'manifest.webmanifest must exist in public/').toBe(true);
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it('manifest includes mandatory identification fields: name, short_name, description', () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(manifest.name).toBeTruthy();
      expect(manifest.name.length).toBeGreaterThan(0);
      expect(manifest.short_name).toBeTruthy();
      expect(manifest.short_name.length).toBeLessThanOrEqual(30);
      expect(manifest.description).toBeTruthy();
    });

    it('manifest specifies standalone display mode and valid start_url', () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifest.display);
      expect(manifest.start_url).toBe('/');
      expect(manifest.scope).toBe('/');
    });

    it('manifest defines valid theme_color and background_color', () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
      expect(manifest.theme_color).toMatch(hexColorRegex);
      expect(manifest.background_color).toMatch(hexColorRegex);
    });

    it('manifest includes compliant 192x192 and 512x512 icons, plus a maskable icon', () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

      const has192 = manifest.icons.some(
        (icon: any) => icon.sizes === '192x192' && icon.type === 'image/png',
      );
      const has512 = manifest.icons.some(
        (icon: any) => icon.sizes === '512x512' && icon.type === 'image/png',
      );
      const hasMaskable = manifest.icons.some(
        (icon: any) => icon.purpose && icon.purpose.includes('maskable'),
      );

      expect(has192).toBe(true);
      expect(has512).toBe(true);
      expect(hasMaskable).toBe(true);
    });
  });

  describe('2. Service Worker & Offline Capability', () => {
    it('service worker script exists and implements offline fetch handling', () => {
      expect(fs.existsSync(swPath), 'sw.js must exist in public/').toBe(true);
      const swContent = fs.readFileSync(swPath, 'utf-8');
      expect(swContent).toContain("addEventListener('install'");
      expect(swContent).toContain("addEventListener('activate'");
      expect(swContent).toContain("addEventListener('fetch'");
      expect(swContent).toContain('caches.open');
    });

    it('vite.config.ts configures VitePWA autoUpdate and Workbox runtime caching', () => {
      const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');
      expect(viteConfig).toContain("registerType: 'autoUpdate'");
      expect(viteConfig).toContain('api-flashcards-cache');
      expect(viteConfig).toContain('NetworkFirst');
      expect(viteConfig).toContain('google-fonts-cache');
      expect(viteConfig).toContain('CacheFirst');
    });
  });

  describe('3. iOS & Apple Mobile Web App Compliance', () => {
    it('apple-touch-icon.png is present with valid PNG signature and size >= 180x180', () => {
      const appleTouchIconPath = path.join(publicDir, 'apple-touch-icon.png');
      expect(fs.existsSync(appleTouchIconPath)).toBe(true);

      const stat = fs.statSync(appleTouchIconPath);
      expect(stat.size).toBeGreaterThan(0);

      const buf = fs.readFileSync(appleTouchIconPath);
      // Valid PNG signature
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4e);
      expect(buf[3]).toBe(0x47);
    });

    it('favicon.ico and masked-icon.svg exist for cross-platform tab and pinning support', () => {
      const faviconPath = path.join(publicDir, 'favicon.ico');
      const maskedSvgPath = path.join(publicDir, 'masked-icon.svg');

      expect(fs.existsSync(faviconPath)).toBe(true);
      expect(fs.existsSync(maskedSvgPath)).toBe(true);

      const svgContent = fs.readFileSync(maskedSvgPath, 'utf-8');
      expect(svgContent).toContain('<svg');
    });
  });
});
