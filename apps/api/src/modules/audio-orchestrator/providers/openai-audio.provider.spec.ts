import { ConfigService } from '@nestjs/config';
import { OpenAiAudioProvider } from './openai-audio.provider';
import { AudioVoice } from '@ai-interview/contracts';

describe('OpenAiAudioProvider', () => {
  let provider: OpenAiAudioProvider;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, defaultVal: any) => {
        if (key === 'ai.openaiApiKey') return 'test-openai-key';
        return defaultVal;
      }),
    };

    provider = new OpenAiAudioProvider(mockConfigService as ConfigService);
  });

  it('initializes with name openai', () => {
    expect(provider.name).toBe('openai');
  });

  it('throws validation error if audioBuffer is empty for transcribe', async () => {
    const emptyBuffer = Buffer.alloc(0);
    await expect(provider.transcribe(emptyBuffer)).rejects.toThrow();
  });

  it('throws validation error if text is empty for synthesize', async () => {
    await expect(provider.synthesize('')).rejects.toThrow();
  });
});
