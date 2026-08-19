import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { MockAiProvider } from './providers/mock-ai.provider';
import { ExternalAiProvider } from './providers/external-ai.provider';
import { PromptRegistryService } from './prompt-registry/prompt-registry.service';
import { PrismaService } from '../platform/prisma/prisma.service';

describe('AiOrchestratorService', () => {
  let service: AiOrchestratorService;

  const mockPrismaService = {
    aiRun: {
      create: jest.fn().mockResolvedValue({ id: 'airun-uuid' }),
    },
  };

  const mockPromptRegistry = {
    getActivePrompt: jest.fn().mockResolvedValue({
      id: 'pv-1',
      slug: 'question_generator',
      systemPrompt: 'System prompt test',
      userPromptTemplate: 'Template test',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiOrchestratorService,
        MockAiProvider,
        ExternalAiProvider,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PromptRegistryService,
          useValue: mockPromptRegistry,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: any) => {
              if (key === 'ai.provider') return 'mock';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AiOrchestratorService>(AiOrchestratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generates a structured question successfully with MockAiProvider', async () => {
    const result = await service.generateQuestion('session-123', {
      role: 'Frontend Engineer',
      level: 'Mid-Level',
      technologies: ['React', 'TypeScript'],
      turnNumber: 1,
      difficulty: 1,
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.keyFocus).toBeDefined();
    expect(Array.isArray(result.expectedKeyPoints)).toBe(true);
    expect(mockPrismaService.aiRun.create).toHaveBeenCalled();
  });

  it('evaluates an answer successfully with MockAiProvider', async () => {
    const result = await service.evaluateAnswer('session-123', {
      role: 'Frontend Engineer',
      level: 'Mid-Level',
      question: 'Explain React hooks.',
      answer: 'React hooks let you use state and lifecycle methods in functional components.',
    });

    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.rubricScores.technicalAccuracy).toBeDefined();
    expect(result.strengths.length).toBeGreaterThan(0);
  });
});
