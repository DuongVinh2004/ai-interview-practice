import { Injectable, Logger } from '@nestjs/common';

export interface VADResult {
  isSpeaking: boolean;
  rms: number;
  speechDurationMs: number;
  silenceDurationMs: number;
  isBargeIn: boolean; // True if candidate interrupted while AI was speaking
}

@Injectable()
export class VadEngineService {
  private readonly logger = new Logger(VadEngineService.name);

  // Energy threshold for voice detection (normalized RMS 0.0 to 1.0)
  private readonly energyThreshold = 0.02;
  private readonly minSpeechFrames = 3;
  private readonly minSilenceFrames = 15;

  /**
   * Computes Root Mean Square (RMS) energy of a PCM16 audio buffer
   */
  calculateRms(pcmBuffer: Buffer): number {
    if (!pcmBuffer || pcmBuffer.length < 2) return 0;

    let sumSquares = 0;
    const sampleCount = Math.floor(pcmBuffer.length / 2);

    for (let i = 0; i < sampleCount; i++) {
      const sample = pcmBuffer.readInt16LE(i * 2) / 32768.0;
      sumSquares += sample * sample;
    }

    return Math.sqrt(sumSquares / sampleCount);
  }

  /**
   * Evaluates audio frame for voice activity and barge-in
   */
  processFrame(
    pcmBuffer: Buffer,
    state: {
      consecutiveSpeechFrames: number;
      consecutiveSilenceFrames: number;
      isAiSpeaking: boolean;
    },
    frameDurationMs = 20,
  ): VADResult {
    const rms = this.calculateRms(pcmBuffer);
    const isAboveThreshold = rms >= this.energyThreshold;

    let isSpeaking = false;
    let isBargeIn = false;

    if (isAboveThreshold) {
      state.consecutiveSpeechFrames += 1;
      state.consecutiveSilenceFrames = 0;

      if (state.consecutiveSpeechFrames >= this.minSpeechFrames) {
        isSpeaking = true;
        if (state.isAiSpeaking) {
          isBargeIn = true;
        }
      }
    } else {
      state.consecutiveSilenceFrames += 1;
      if (state.consecutiveSilenceFrames >= this.minSilenceFrames) {
        state.consecutiveSpeechFrames = 0;
        isSpeaking = false;
      } else if (state.consecutiveSpeechFrames >= this.minSpeechFrames) {
        // Still within short pause
        isSpeaking = true;
      }
    }

    return {
      isSpeaking,
      rms,
      speechDurationMs: state.consecutiveSpeechFrames * frameDurationMs,
      silenceDurationMs: state.consecutiveSilenceFrames * frameDurationMs,
      isBargeIn,
    };
  }
}
