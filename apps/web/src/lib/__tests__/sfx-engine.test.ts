import { describe, it, expect, beforeEach } from 'vitest';
import { sfx, playSFX } from '../sfx-engine';

describe('SfxEngine', () => {
  beforeEach(() => {
    sfx.setIsMuted(false);
    sfx.setVolume(0.5);
  });

  it('should get and set muted state', () => {
    expect(sfx.getIsMuted()).toBe(false);
    sfx.setIsMuted(true);
    expect(sfx.getIsMuted()).toBe(true);
  });

  it('should clamp volume between 0 and 1', () => {
    sfx.setVolume(1.5);
    expect(sfx.getVolume()).toBe(1);

    sfx.setVolume(-0.5);
    expect(sfx.getVolume()).toBe(0);

    sfx.setVolume(0.75);
    expect(sfx.getVolume()).toBe(0.75);
  });

  it('should execute play method without throwing even when Web Audio is not available in test environment', () => {
    expect(() => playSFX('click')).not.toThrow();
    expect(() => playSFX('success')).not.toThrow();
    expect(() => playSFX('error')).not.toThrow();
    expect(() => playSFX('level_up')).not.toThrow();
    expect(() => playSFX('xp_coin')).not.toThrow();
    expect(() => playSFX('streak')).not.toThrow();
    expect(() => playSFX('card_flip')).not.toThrow();
  });
});
