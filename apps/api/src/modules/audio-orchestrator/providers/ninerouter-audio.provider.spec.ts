import { ConfigService } from '@nestjs/config';
import { NineRouterAudioProvider } from './ninerouter-audio.provider';
import { AudioVoice } from '@ai-interview/contracts';

describe('NineRouterAudioProvider', () => {
  let provider: NineRouterAudioProvider;
  let mockConfigService: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, defaultVal: any) => {
        if (key === 'ai.ninerouterUrl') return 'http://localhost:20128';
        if (key === 'ai.ninerouterKey') return 'sk-test-key';
        if (key === 'ai.ninerouterSttModel') return 'groq/whisper-large-v3-turbo';
        if (key === 'ai.ninerouterTtsModel') return 'edge-tts/vi-VN-HoaiMyNeural';
        return defaultVal;
      }),
    };

    provider = new NineRouterAudioProvider(mockConfigService as ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('initializes with name ninerouter', () => {
    expect(provider.name).toBe('ninerouter');
  });

  it('throws validation error if audioBuffer is empty for transcribe', async () => {
    const emptyBuffer = Buffer.alloc(0);
    await expect(provider.transcribe(emptyBuffer)).rejects.toThrow('Audio buffer cannot be empty');
  });

  it('throws validation error if text is empty for synthesize', async () => {
    await expect(provider.synthesize('')).rejects.toThrow('Synthesis text cannot be empty');
  });

  it('transcribes audio successfully via 9Router endpoint', async () => {
    const mockAudio = Buffer.from('mock audio content');
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        text: 'Xin chào, đây là bài kiểm tra.',
        duration: 2.5,
        language: 'vi',
      }),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse as any);

    const result = await provider.transcribe(mockAudio, 'audio/webm', 'test.webm', 'vi');

    expect(result.text).toBe('Xin chào, đây là bài kiểm tra.');
    expect(result.detectedLanguage).toBe('vi');
    expect(result.provider).toBe('ninerouter');
    expect(result.model).toBe('groq/whisper-large-v3-turbo');
    expect(result.durationSeconds).toBe(2.5);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:20128/v1/audio/transcriptions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test-key',
        }),
      }),
    );
  });

  it('handles STT error from 9Router', async () => {
    const mockAudio = Buffer.from('mock audio');
    const mockResponse = {
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('All accounts unavailable'),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse as any);

    await expect(provider.transcribe(mockAudio)).rejects.toThrow('9Router STT failed');
  });

  it('synthesizes text to speech successfully via 9Router endpoint', async () => {
    const audioBytes = new Uint8Array([1, 2, 3, 4]);
    const mockResponse = {
      ok: true,
      status: 200,
      arrayBuffer: jest.fn().mockResolvedValue(audioBytes.buffer),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse as any);

    const result = await provider.synthesize('Xin chào lập trình viên');

    expect(result.audioBuffer).toBeDefined();
    expect(result.provider).toBe('ninerouter');
    expect(result.model).toBe('edge-tts/vi-VN-HoaiMyNeural');
    expect(result.mimeType).toBe('audio/mpeg');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:20128/v1/audio/speech',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'edge-tts/vi-VN-HoaiMyNeural',
          input: 'Xin chào lập trình viên',
        }),
      }),
    );
  });

  it('handles TTS error from 9Router', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue('Unauthorized: invalid api key'),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse as any);

    await expect(provider.synthesize('test')).rejects.toThrow('9Router TTS failed');
  });
});
