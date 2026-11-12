import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('PWA Icon Assets (Task 2.2)', () => {
  const publicDir = path.resolve(__dirname, '../../public');
  const iconFiles = [
    'pwa-192x192.png',
    'pwa-512x512.png',
    'apple-touch-icon.png',
    'masked-icon.svg',
    'favicon.ico',
  ];

  it('all required PWA icons exist in apps/web/public', () => {
    for (const file of iconFiles) {
      const fullPath = path.join(publicDir, file);
      expect(fs.existsSync(fullPath), `Expected ${file} to exist`).toBe(true);
      const stat = fs.statSync(fullPath);
      expect(stat.size, `Expected ${file} to have non-zero size`).toBeGreaterThan(0);
    }
  });

  it('validates PNG headers for png assets', () => {
    const pngFiles = ['pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png'];
    // PNG signature: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

    for (const file of pngFiles) {
      const buf = fs.readFileSync(path.join(publicDir, file));
      for (let i = 0; i < pngSignature.length; i++) {
        expect(buf[i], `Byte ${i} of ${file}`).toBe(pngSignature[i]);
      }
    }
  });

  it('validates SVG contents for masked-icon.svg', () => {
    const content = fs.readFileSync(path.join(publicDir, 'masked-icon.svg'), 'utf-8');
    expect(content).toContain('<svg');
    expect(content).toContain('10b981');
    expect(content).toContain('AI');
  });

  it('validates ICO header for favicon.ico', () => {
    const buf = fs.readFileSync(path.join(publicDir, 'favicon.ico'));
    // ICO header: 0x00 0x00 0x01 0x00
    expect(buf[0]).toBe(0x00);
    expect(buf[1]).toBe(0x00);
    expect(buf[2]).toBe(0x01);
    expect(buf[3]).toBe(0x00);
  });
});
