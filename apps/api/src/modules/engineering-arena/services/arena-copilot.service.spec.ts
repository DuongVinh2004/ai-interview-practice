import { Test, TestingModule } from '@nestjs/testing';
import { ArenaCopilotService } from './arena-copilot.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ArenaSessionRepository } from '../repositories/arena-session.repository';
import { ArenaAiAssistanceMode, ChallengeDomain, ChallengeCategory } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

describe('ArenaCopilotService (Phase P9 Safe AI Pairing)', () => {
  let service: ArenaCopilotService;
  let sessionRepo: {
    findSessionById: jest.Mock;
    recordActionEvent: jest.Mock;
  };
  let prisma: any;

  const mockManifest = {
    schemaVersion: '1.0' as const,
    slug: 'copilot-test',
    title: 'Copilot Test',
    description: 'Test copilot',
    domain: ChallengeDomain.SECURITY,
    category: ChallengeCategory.SECURITY_REMEDIATION,
    difficulty: 3,
    estimatedMinutes: 30,
    environment: { runtime: 'node:22', memoryLimitMb: 512, cpuLimit: 1.0 },
    visibleFiles: ['src/auth.ts'],
    editableFiles: ['src/auth.ts'],
    hiddenFiles: ['test/hidden.test.ts'],
    commands: [],
    rubric: { version: '1.0', objectiveWeight: 0.7, rubricWeight: 0.3, criteria: [] },
    skills: [],
  };

  const mockSession = {
    id: 's-copilot-1',
    userId: 'u-1',
    aiAssistanceMode: ArenaAiAssistanceMode.HINTS_ONLY,
    challengeVersion: {
      manifestJson: mockManifest,
    },
  };

  beforeEach(async () => {
    sessionRepo = {
      findSessionById: jest.fn(),
      recordActionEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArenaCopilotService,
        { provide: PrismaService, useValue: {} },
        { provide: ArenaSessionRepository, useValue: sessionRepo },
      ],
    }).compile();

    service = module.get<ArenaCopilotService>(ArenaCopilotService);
  });

  describe('sanitizeContext guardrails', () => {
    it('strips hidden tests and .env secret files from AI context', () => {
      const sanitized = service.sanitizeContext(mockManifest, {
        'src/auth.ts': 'export const auth = true;',
        'test/hidden.test.ts': 'secret test suite',
        '.env.production': 'DATABASE_SECRET_KEY=12345',
      });

      expect(sanitized['src/auth.ts']).toBeDefined();
      expect(sanitized['test/hidden.test.ts']).toBeUndefined();
      expect(sanitized['.env.production']).toBeUndefined();
    });
  });

  describe('askCopilot', () => {
    it('returns hint guidance and records audit event in HINTS_ONLY mode', async () => {
      sessionRepo.findSessionById.mockResolvedValue(mockSession);

      const response = await service.askCopilot('u-1', {
        sessionId: 's-copilot-1',
        userQuestion: 'How do I prevent the race condition?',
        activeFilePath: 'src/auth.ts',
        activeFileContent: 'function check() {}',
      });

      expect(response.mode).toBe(ArenaAiAssistanceMode.HINTS_ONLY);
      expect(response.answer).toContain('[Hint]');
      expect(sessionRepo.recordActionEvent).toHaveBeenCalled();
    });

    it('rejects query if AI mode is DISABLED', async () => {
      sessionRepo.findSessionById.mockResolvedValue({
        ...mockSession,
        aiAssistanceMode: ArenaAiAssistanceMode.DISABLED,
      });

      await expect(
        service.askCopilot('u-1', {
          sessionId: 's-copilot-1',
          userQuestion: 'Help me',
        }),
      ).rejects.toThrow(DomainException);
    });
  });
});
