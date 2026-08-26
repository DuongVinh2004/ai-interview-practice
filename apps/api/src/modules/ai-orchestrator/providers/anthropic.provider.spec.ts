import { ConfigService } from '@nestjs/config';
import { AnthropicProvider } from './anthropic.provider';

describe('AnthropicProvider Spec', () => {
  let provider: AnthropicProvider;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue: any) => {
        if (key === 'ai.anthropicApiKey') return 'test-anthropic-key';
        if (key === 'ai.anthropicModel') return 'claude-sonnet-4-20250514';
        return defaultValue;
      }),
    };

    provider = new AnthropicProvider(mockConfigService as ConfigService);
  });

  it('is defined with correct provider name', () => {
    expect(provider).toBeDefined();
    expect(provider.name).toBe('anthropic');
  });

  it('throws DomainException if API key is missing when invoking methods', async () => {
    const unconfiguredProvider = new AnthropicProvider({
      get: jest.fn().mockReturnValue(''),
    } as any);

    await expect(
      unconfiguredProvider.generateQuestion(
        {
          role: 'Backend',
          level: 'Senior',
          technologies: ['Node.js'],
          turnNumber: 1,
          difficulty: 1,
        },
        'System prompt',
      ),
    ).rejects.toThrow('Anthropic API key is not configured.');
  });
});
