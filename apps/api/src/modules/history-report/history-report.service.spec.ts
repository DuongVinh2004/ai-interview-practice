import { Test, TestingModule } from '@nestjs/testing';
import { HistoryReportService } from './history-report.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { SessionState, SessionMode, UserRole } from '@ai-interview/contracts';

describe('HistoryReportService', () => {
  let service: HistoryReportService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      interviewSession: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryReportService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<HistoryReportService>(HistoryReportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHistory', () => {
    it('returns filtered and paginated sessions with search and score filters', async () => {
      prisma.interviewSession.count.mockResolvedValue(1);
      prisma.interviewSession.findMany.mockResolvedValue([
        {
          id: 'sess-1',
          state: SessionState.COMPLETED,
          sessionMode: SessionMode.STANDARD,
          competencyArea: null,
          isSandbox: false,
          currentTurn: 5,
          totalTurns: 5,
          targetDifficulty: 2,
          overallScore: 8.5,
          completedAt: new Date('2026-08-20T00:00:00Z'),
          createdAt: new Date('2026-08-20T00:00:00Z'),
          jobRole: { id: 'role-1', name: 'Backend Engineer' },
          seniorityLevel: { id: 'lvl-1', name: 'Senior' },
          technologies: [{ technology: { id: 'tech-1', name: 'Node.js' } }],
        },
      ]);

      const result = await service.getHistory('user-1', {
        page: 1,
        limit: 10,
        search: 'Backend',
        sessionMode: SessionMode.STANDARD,
        minScore: 8.0,
        maxScore: 10.0,
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe('sess-1');
      expect(result.items[0].overallScore).toBe(8.5);
      expect(result.meta.total).toBe(1);
      expect(prisma.interviewSession.findMany).toHaveBeenCalled();
    });
  });

  describe('getSessionResult', () => {
    it('returns detailed session result with rubrics and learning path', async () => {
      const mockSession = {
        id: 'sess-1',
        userId: 'user-1',
        state: SessionState.COMPLETED,
        overallScore: 0,
        completedAt: new Date('2026-08-20T00:30:00Z'),
        jobRole: { name: 'Backend Engineer' },
        seniorityLevel: { name: 'Senior' },
        technologies: [
          { technology: { id: 'node', name: 'Node.js' } },
          { technology: { id: 'postgres', name: 'PostgreSQL' } },
          { technology: { id: 'typescript', name: 'TypeScript' } },
        ],
        turns: [
          {
            turnNumber: 1,
            question: { content: 'Explain indexing' },
            answer: {
              content: 'B-tree indexes...',
              submittedAt: new Date('2026-08-20T00:05:00Z'),
              evaluation: {
                score: 8.5,
                authorityState: 'NEEDS_REVIEW',
                rubricScores: { technicalAccuracy: 9, depth: 8, clarity: 8.5 },
                strengths: [],
                improvements: [],
                conciseFeedback: 'Good',
                evidence: [],
              },
            },
          },
        ],
        learningPath: {
          id: 'lp-1',
          status: 'READY',
          summary: 'Roadmap with an overall performance score of 0.0/10',
          items: [
            {
              id: 'item-1',
              gap: 'Index selection',
              topic: 'Indexes',
              priority: 'HIGH',
              recommendedAction: 'Practice query plans',
              searchKeywords: ['postgres indexes'],
              order: 1,
              isCompleted: true,
              completedAt: new Date('2026-08-21T00:00:00Z'),
            },
          ],
        },
      };

      prisma.interviewSession.findUnique.mockResolvedValue(mockSession);

      const result = await service.getSessionResult('user-1', UserRole.CANDIDATE, 'sess-1');
      expect(result).toBeDefined();
      expect(result.turns.length).toBe(1);
      expect(result.overallScore).toBe(8.5);
      expect(result.rubricAverages).toEqual({
        technicalAccuracy: 9,
        depth: 8,
        clarity: 8.5,
      });
      expect(result.technologies.map((technology: any) => technology.name)).toEqual([
        'Node.js',
        'PostgreSQL',
        'TypeScript',
      ]);
      expect(result.learningPath?.items[0]).toMatchObject({
        isCompleted: true,
        completedAt: '2026-08-21T00:00:00.000Z',
      });
      expect(result.learningPath?.summary).toContain('overall performance score of 8.5/10');
    });

    it('denies access to non-owner ADMIN if mfaVerified is false', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: 'other-user',
        turns: [],
      });

      await expect(
        service.getSessionResult('admin-user', UserRole.ADMIN, 'sess-1', false),
      ).rejects.toThrow();
    });
  });
});
