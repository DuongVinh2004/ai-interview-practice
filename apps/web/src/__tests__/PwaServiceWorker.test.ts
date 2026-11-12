import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('PWA Service Worker & Manifest Configuration (Plan C4.1)', () => {
  const viteConfigPath = path.resolve(__dirname, '../../vite.config.ts');
  const manifestPublicPath = path.resolve(__dirname, '../../public/manifest.webmanifest');
  const swPublicPath = path.resolve(__dirname, '../../public/sw.js');
  const viteConfigFile = fs.readFileSync(viteConfigPath, 'utf-8');

  it('configures Workbox runtime caching for Google Fonts with CacheFirst', () => {
    // Assert Google Fonts is cached using CacheFirst strategy
    expect(viteConfigFile).toMatch(
      /urlPattern:\s*\/\^https:\\\/\\\/fonts\\\.googleapis\\\.com\\\/\.\*\/i/,
    );
    expect(viteConfigFile).toContain("handler: 'CacheFirst'");
    expect(viteConfigFile).toContain("cacheName: 'google-fonts-cache'");
  });

  it('configures Workbox runtime caching for /api/v1/flashcards/* with NetworkFirst', () => {
    // Assert /api/v1/flashcards API is cached using NetworkFirst strategy for offline drills
    expect(viteConfigFile).toMatch(/urlPattern:\s*\/\\\/api\\\/v1\\\/flashcards\\\/\.\*\/i/);
    expect(viteConfigFile).toContain("cacheName: 'api-flashcards-cache'");
    expect(viteConfigFile).toContain("handler: 'NetworkFirst'");
  });

  it('validates manifest.webmanifest schema with required PWA metadata', () => {
    expect(fs.existsSync(manifestPublicPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPublicPath, 'utf-8'));

    expect(manifest.name).toBe('AI Interview Practice');
    expect(manifest.short_name).toBe('AI Interview');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBeDefined();
    expect(manifest.background_color).toBeDefined();

    // Icons validation
    expect(Array.isArray(manifest.icons)).toBe(true);
    const iconSizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(iconSizes).toContain('192x192');
    expect(iconSizes).toContain('512x512');

    const hasMaskable = manifest.icons.some(
      (icon: { purpose?: string }) => icon.purpose && icon.purpose.includes('maskable'),
    );
    expect(hasMaskable).toBe(true);
  });

  it('ensures referenced PWA icon files actually exist on disk', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPublicPath, 'utf-8'));
    const publicDir = path.resolve(__dirname, '../../public');

    for (const icon of manifest.icons) {
      const iconFileName = icon.src.replace(/^\//, '');
      const iconFilePath = path.join(publicDir, iconFileName);
      expect(fs.existsSync(iconFilePath), `Icon file ${iconFileName} must exist in public/`).toBe(
        true,
      );
    }
  });

  it('validates public/sw.js implements CacheFirst for fonts and offline assets, NetworkFirst for flashcards API', () => {
    expect(fs.existsSync(swPublicPath), 'sw.js must exist in public/').toBe(true);
    const swContent = fs.readFileSync(swPublicPath, 'utf-8');

    // NetworkFirst for flashcards
    expect(swContent).toMatch(/\/flashcards/);
    expect(swContent).toContain('caches.match');
    expect(swContent).toContain('caches.open');

    // CacheFirst for Google Fonts and assets
    expect(swContent).toMatch(/fonts\.googleapis\.com/);
  });

  it('validates public/sw.js implements push event handler for Web Push notifications', () => {
    const swContent = fs.readFileSync(swPublicPath, 'utf-8');

    expect(swContent).toContain("addEventListener('push'");
    expect(swContent).toContain('showNotification');
    expect(swContent).toContain('.json()');
  });

  it('validates public/sw.js implements notificationclick event handler navigating to target URL', () => {
    const swContent = fs.readFileSync(swPublicPath, 'utf-8');

    expect(swContent).toContain("addEventListener('notificationclick'");
    expect(swContent).toContain('notification.close()');
    expect(swContent).toContain('clients.matchAll');
  });
});
