import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider';

describe('GeminiProvider Spec', () => {
  let provider: GeminiProvider;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue: any) => {
        if (key === 'ai.geminiApiKey') return 'test-gemini-key';
        if (key === 'ai.geminiModel') return 'gemini-2.0-flash';
        return defaultValue;
      }),
    };

    provider = new GeminiProvider(mockConfigService as ConfigService);
  });

  it('is defined with correct provider name', () => {
    expect(provider).toBeDefined();
    expect(provider.name).toBe('gemini');
  });

  it('throws DomainException if API key is missing when invoking methods', async () => {
    const unconfiguredProvider = new GeminiProvider({
      get: jest.fn().mockReturnValue(''),
    } as any);

    await expect(
      unconfiguredProvider.generateQuestion(
        { role: 'Backend', level: 'Senior', technologies: ['Node.js'], turnNumber: 1, difficulty: 1 },
        'System prompt',
      ),
    ).rejects.toThrow('Gemini API key is not configured.');
  });
});
