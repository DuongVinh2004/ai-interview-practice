/**
 * SFX Engine (Web Audio API Synthesizer + Fallback)
 * Zero-latency, zero-asset failure, 100% offline-ready sound synthesizer for UI micro-interactions.
 */

export type SoundEffectType =
  | 'click'
  | 'success'
  | 'error'
  | 'level_up'
  | 'xp_coin'
  | 'streak'
  | 'card_flip';

class SfxEngine {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.5;

  constructor() {
    this.initFromStorage();
  }

  private initFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const storedMute = localStorage.getItem('ai-interview-sfx-muted');
      if (storedMute !== null) {
        this.isMuted = storedMute === 'true';
      }
      const storedVol = localStorage.getItem('ai-interview-sfx-volume');
      if (storedVol !== null) {
        const parsed = parseFloat(storedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.volume = parsed;
        }
      }
    } catch {
      // Ignore in restricted environments
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.audioCtx) {
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setIsMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai-interview-sfx-muted', String(muted));
      }
    } catch {
      // Ignore
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai-interview-sfx-volume', String(this.volume));
      }
    } catch {
      // Ignore
    }
  }

  public play(type: SoundEffectType): void {
    if (this.isMuted || this.volume <= 0) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    try {
      switch (type) {
        case 'click': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

          gain.gain.setValueAtTime(this.volume * 0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.04);
          break;
        }

        case 'card_flip': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(300, now);
          osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);

          gain.gain.setValueAtTime(this.volume * 0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.08);
          break;
        }

        case 'xp_coin': {
          // Bright dual coin chime
          const notes = [987.77, 1318.51]; // B5 -> E6
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const startTime = now + idx * 0.08;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(this.volume * 0.35, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.25);
          });
          break;
        }

        case 'success': {
          // Major chord arpeggio: C5, E5, G5
          const chord = [523.25, 659.25, 783.99];
          chord.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const startTime = now + idx * 0.06;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(this.volume * 0.3, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.35);
          });
          break;
        }

        case 'error': {
          // Low dissonance buzz
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.linearRampToValueAtTime(120, now + 0.18);

          gain.gain.setValueAtTime(this.volume * 0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.18);
          break;
        }

        case 'level_up': {
          // Ascending fanfare fanfare: C4, E4, G4, C5, E5, G5, C6
          const fanfare = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
          fanfare.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const startTime = now + idx * 0.07;
            const duration = idx === fanfare.length - 1 ? 0.6 : 0.2;

            osc.type = idx === fanfare.length - 1 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(this.volume * 0.35, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
          });
          break;
        }

        case 'streak': {
          // Warm harmonic pulse
          const notes = [440, 554.37, 659.25, 880];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const startTime = now + idx * 0.05;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(this.volume * 0.3, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.4);
          });
          break;
        }
      }
    } catch {
      // Audio playback fails gracefully without interrupting UI logic
    }
  }
}

export const sfx = new SfxEngine();

export const playSFX = (type: SoundEffectType) => {
  sfx.play(type);
};
