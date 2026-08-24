import { VadEngineService } from './vad-engine.service';

describe('VadEngineService (Voice Activity Detection & Barge-In)', () => {
  let vad: VadEngineService;

  beforeEach(() => {
    vad = new VadEngineService();
  });

  it('calculates RMS for silent vs loud PCM buffer', () => {
    const silentBuffer = Buffer.alloc(1000);
    const silentRms = vad.calculateRms(silentBuffer);
    expect(silentRms).toBe(0);

    // Create a 1000-byte PCM buffer with simulated sine wave
    const loudBuffer = Buffer.alloc(1000);
    for (let i = 0; i < 500; i++) {
      loudBuffer.writeInt16LE(16000, i * 2);
    }
    const loudRms = vad.calculateRms(loudBuffer);
    expect(loudRms).toBeGreaterThan(0.4);
  });

  it('detects speaking after min speech frames', () => {
    const state = {
      consecutiveSpeechFrames: 0,
      consecutiveSilenceFrames: 0,
      isAiSpeaking: false,
    };

    const loudBuffer = Buffer.alloc(640);
    for (let i = 0; i < 320; i++) {
      loudBuffer.writeInt16LE(15000, i * 2);
    }

    // Frame 1
    const res1 = vad.processFrame(loudBuffer, state, 20);
    expect(res1.isSpeaking).toBe(false); // minSpeechFrames not met yet

    // Frame 2
    const res2 = vad.processFrame(loudBuffer, state, 20);
    expect(res2.isSpeaking).toBe(false);

    // Frame 3
    const res3 = vad.processFrame(loudBuffer, state, 20);
    expect(res3.isSpeaking).toBe(true);
    expect(res3.isBargeIn).toBe(false);
  });

  it('detects barge-in when candidate speaks while AI is speaking', () => {
    const state = {
      consecutiveSpeechFrames: 2,
      consecutiveSilenceFrames: 0,
      isAiSpeaking: true, // AI is actively outputting speech
    };

    const loudBuffer = Buffer.alloc(640);
    for (let i = 0; i < 320; i++) {
      loudBuffer.writeInt16LE(20000, i * 2);
    }

    const res = vad.processFrame(loudBuffer, state, 20);
    expect(res.isSpeaking).toBe(true);
    expect(res.isBargeIn).toBe(true);
  });
});
