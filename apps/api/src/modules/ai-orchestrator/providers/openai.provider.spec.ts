import { ConfigService } from '@nestjs/config';
import { OpenAiProvider } from './openai.provider';

describe('OpenAiProvider Spec', () => {
  let provider: OpenAiProvider;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue: any) => {
        if (key === 'ai.openaiApiKey') return 'test-openai-key';
        if (key === 'ai.openaiModel') return 'gpt-4o';
        return defaultValue;
      }),
    };

    provider = new OpenAiProvider(mockConfigService as ConfigService);
  });

  it('is defined with correct provider name', () => {
    expect(provider).toBeDefined();
    expect(provider.name).toBe('openai');
  });

  it('throws DomainException if API key is missing when invoking methods', async () => {
    const unconfiguredProvider = new OpenAiProvider({
      get: jest.fn().mockReturnValue(''),
    } as any);

    await expect(
      unconfiguredProvider.generateQuestion(
        { role: 'Backend', level: 'Senior', technologies: ['Node.js'], turnNumber: 1, difficulty: 1 },
        'System prompt',
      ),
    ).rejects.toThrow('OpenAI API key is not configured.');
  });
});
