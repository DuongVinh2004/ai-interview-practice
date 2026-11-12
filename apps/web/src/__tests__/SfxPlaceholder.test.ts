import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('SFX Audio Sprite Placeholders (Task 2.1)', () => {
  const sfxDir = path.resolve(__dirname, '../../public/sfx');
  const mp3Path = path.join(sfxDir, 'ui-sprite.mp3');
  const webmPath = path.join(sfxDir, 'ui-sprite.webm');

  it('should have public/sfx directory with ui-sprite.mp3 and ui-sprite.webm', () => {
    expect(fs.existsSync(sfxDir)).toBe(true);
    expect(fs.existsSync(mp3Path)).toBe(true);
    expect(fs.existsSync(webmPath)).toBe(true);

    const mp3Stat = fs.statSync(mp3Path);
    const webmStat = fs.statSync(webmPath);

    expect(mp3Stat.size).toBeGreaterThan(0);
    expect(webmStat.size).toBeGreaterThan(0);
  });

  it('should have valid MP3 frame sync header in ui-sprite.mp3', () => {
    const buffer = fs.readFileSync(mp3Path);
    expect(buffer.length).toBeGreaterThan(4);
    // MPEG Audio frame sync: 0xFF followed by 0xFB (MPEG-1 Layer 3, no CRC) or 0xFA
    expect(buffer[0]).toBe(0xff);
    expect(buffer[1] & 0xe0).toBe(0xe0); // sync bits
  });

  it('should have valid EBML header in ui-sprite.webm', () => {
    const buffer = fs.readFileSync(webmPath);
    expect(buffer.length).toBeGreaterThan(4);
    // EBML ID: 0x1A 0x45 0xDF 0xA3
    expect(buffer[0]).toBe(0x1a);
    expect(buffer[1]).toBe(0x45);
    expect(buffer[2]).toBe(0xdf);
    expect(buffer[3]).toBe(0xa3);
  });
});
