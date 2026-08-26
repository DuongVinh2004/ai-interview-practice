import { Test, TestingModule } from '@nestjs/testing';
import { BehavioralService } from './behavioral.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { UserRole, LiveSessionStatus, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { HttpStatus } from '@nestjs/common';

describe('BehavioralService (F007 / SEC-004)', () => {
  let service: BehavioralService;
  let prismaMock: any;

  const ownerUserId = '11111111-1111-4111-a111-111111111111';
  const otherUserId = '22222222-2222-4222-a222-222222222222';
  const mentorUserId = '33333333-3333-4333-a333-333333333333';
  const unrelatedMentorUserId = '44444444-4444-4444-a444-444444444444';
  const adminUserId = '55555555-5555-4555-a555-555555555555';

  const sessionId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const answerId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

  beforeEach(async () => {
    prismaMock = {
      behavioralCompetency: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'comp-1',
            slug: 'leadership',
            name: 'Leadership',
            nameVi: 'Lãnh đạo',
            questions: [
              {
                id: 'q-1',
                companyPreset: 'AMAZON_LEADERSHIP',
                templateText: 'Tell me about a time you took ownership...',
                templateTextVi: 'Hãy kể về...',
                difficulty: 2,
              },
            ],
          },
        ]),
      },
      interviewSession: {
        findUnique: jest.fn(),
      },
      answer: {
        findUnique: jest.fn(),
      },
      mentorProfile: {
        findUnique: jest.fn(),
      },
      liveSession: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BehavioralService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<BehavioralService>(BehavioralService);
  });

  describe('analyzeStar logic', () => {
    it('should generate dynamic probing question when candidate answer lacks quantifiable results', async () => {
      const analysis = await service.analyzeStar({
        sessionId: 'session-123',
        turnNumber: 1,
        questionText: 'Describe a challenging technical project you led.',
        candidateAnswer:
          'At my company, we had high server load. I was responsible for fixing it. I implemented Redis caching and load balancing with Nginx.',
      });

      expect(analysis.actionNeeded).toBe('PROBE');
      expect(analysis.starIdentified.result).toBe(false);
      expect(analysis.probeText).toContain('quantifiable');
      expect(analysis.probeTextVi).toBeDefined();
    });

    it('should return COMPLETE when all STAR components are present', async () => {
      const analysis = await service.analyzeStar({
        sessionId: 'session-123',
        turnNumber: 1,
        questionText: 'Describe a challenging technical project you led.',
        candidateAnswer:
          'When I was at TechCorp, our production microservice had latency spikes. My responsibility was to optimize queries. I implemented connection pooling with PgBouncer and indexing. As a result, we reduced p99 latency by 65%.',
      });

      expect(analysis.actionNeeded).toBe('COMPLETE');
      expect(analysis.starIdentified.situation).toBe(true);
      expect(analysis.starIdentified.task).toBe(true);
      expect(analysis.starIdentified.action).toBe(true);
      expect(analysis.starIdentified.result).toBe(true);
    });

    it('should list competencies with company presets', async () => {
      const competencies = await service.listCompetencies();
      expect(competencies.length).toBe(1);
      expect(competencies[0].slug).toBe('leadership');
      expect(competencies[0].questions[0].companyPreset).toBe('AMAZON_LEADERSHIP');
    });
  });

  describe('SEC-004 Authorization for getStarEvaluationReport', () => {
    const mockAnswerWithOwner = {
      id: answerId,
      content:
        'Situation: latency spike. Task: optimize DB. Action: added indexes. Result: 50% faster.',
      turn: {
        session: {
          id: sessionId,
          userId: ownerUserId,
        },
      },
      starEvaluation: {
        id: 'star-eval-1',
        answerId,
        situationText: 'Latency spike',
        taskText: 'Optimize DB',
        actionText: 'Added indexes',
        resultText: '50% faster',
        situationScore: 3.5,
        taskScore: 3.5,
        actionScore: 4.0,
        resultScore: 3.5,
        structureScore: 2.0,
        totalScore: 9.2,
        feedback: 'Outstanding STAR structure',
        probingQuestionsAsked: [],
        createdAt: new Date('2026-08-25T10:00:00Z'),
      },
    };

    const mockAnswerWithoutStarEval = {
      id: answerId,
      content:
        'In my previous project, we faced a deadline. My task was backend. I built the API. We delivered on time.',
      turn: {
        session: {
          id: sessionId,
          userId: ownerUserId,
        },
      },
      starEvaluation: null,
    };

    it('allows owner to retrieve persisted STAR report', async () => {
      prismaMock.answer.findUnique.mockResolvedValue(mockAnswerWithOwner);

      const report = await service.getStarEvaluationReport(
        ownerUserId,
        UserRole.CANDIDATE,
        answerId,
      );

      expect(report).toBeDefined();
      expect(report.id).toBe('star-eval-1');
      expect(report.answerId).toBe(answerId);
      expect(report.scores.totalScore).toBe(9.2);
    });

    it('allows owner to retrieve fallback on-the-fly STAR report when evaluation is pending', async () => {
      prismaMock.answer.findUnique.mockResolvedValue(mockAnswerWithoutStarEval);

      const report = await service.getStarEvaluationReport(
        ownerUserId,
        UserRole.CANDIDATE,
        answerId,
      );

      expect(report).toBeDefined();
      expect(report.id).toBe('temp-star-report');
      expect(report.answerId).toBe(answerId);
      expect(report.scores).toBeDefined();
    });

    it('denies non-owner candidate from retrieving persisted STAR report (BOLA mitigation)', async () => {
      prismaMock.answer.findUnique.mockResolvedValue(mockAnswerWithOwner);
      prismaMock.mentorProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.getStarEvaluationReport(otherUserId, UserRole.CANDIDATE, answerId),
      ).rejects.toThrow(
        new DomainException(
          ErrorCode.FORBIDDEN,
          'You do not have permission to access this STAR report',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('denies non-owner candidate from retrieving fallback on-the-fly STAR report', async () => {
      prismaMock.answer.findUnique.mockResolvedValue(mockAnswerWithoutStarEval);
      prismaMock.mentorProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.getStarEvaluationReport(otherUserId, UserRole.CANDIDATE, answerId),
      ).rejects.toThrow(
        new DomainException(
          ErrorCode.FORBIDDEN,
          'You do not have permission to access this STAR report',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('allows explicit ADMIN role to retrieve candidate STAR report', async () => {
      prismaMock.answer.findUnique.mockResolvedValue(mockAnswerWithOwner);

      const report = await service.getStarEvaluationReport(adminUserId, UserRole.ADMIN, answerId);

      expect(report).toBeDefined();
      expect(report.id).toBe('star-eval-1');
    });

    it('allows authorized mentor with active LiveSession to retrieve candidate STAR report', async () => {
      prismaMock.answer.findUnique.mockResolvedValue(mockAnswerWithOwner);
      prismaMock.mentorProfile.findUnique.mockResolvedValue({
        id: 'mentor-prof-1',
        userId: mentorUserId,
      });
      prismaMock.liveSession.findFirst.mockResolvedValue({
        id: 'live-session-1',
        mentorId: 'mentor-prof-1',
        candidateId: ownerUserId,
        status: LiveSessionStatus.IN_PROGRESS,
      });

      const report = await service.getStarEvaluationReport(
        mentorUserId,
        UserRole.CANDIDATE,
        answerId,
      );

      expect(report).toBeDefined();
      expect(report.id).toBe('star-eval-1');
      expect(prismaMock.liveSession.findFirst).toHaveBeenCalledWith({
        where: {
          mentorId: 'mentor-prof-1',
          candidateId: ownerUserId,
          status: {
            in: [
              LiveSessionStatus.SCHEDULED,
              LiveSessionStatus.IN_PROGRESS,
              LiveSessionStatus.COMPLETED,
            ],
          },
        },
        select: { id: true },
      });
    });

    it('denies unrelated mentor without LiveSession with candidate', async () => {
      prismaMock.answer.findUnique.mockResolvedValue(mockAnswerWithOwner);
      prismaMock.mentorProfile.findUnique.mockResolvedValue({
        id: 'mentor-prof-2',
        userId: unrelatedMentorUserId,
      });
      prismaMock.liveSession.findFirst.mockResolvedValue(null);

      await expect(
        service.getStarEvaluationReport(unrelatedMentorUserId, UserRole.CANDIDATE, answerId),
      ).rejects.toThrow(
        new DomainException(
          ErrorCode.FORBIDDEN,
          'You do not have permission to access this STAR report',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('throws 404 RESOURCE_NOT_FOUND when answer does not exist (enumeration resistance)', async () => {
      prismaMock.answer.findUnique.mockResolvedValue(null);

      await expect(
        service.getStarEvaluationReport(ownerUserId, UserRole.CANDIDATE, 'non-existent-id'),
      ).rejects.toThrow(
        new DomainException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Answer not found for STAR report',
          HttpStatus.NOT_FOUND,
        ),
      );
    });
  });

  describe('SEC-004 Authorization for analyzeStar with sessionId', () => {
    it('allows session owner to analyze real-time answer', async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerUserId,
      });

      const analysis = await service.analyzeStar(
        {
          sessionId,
          turnNumber: 1,
          questionText: 'Tell me about a time you solved a bug',
          candidateAnswer: 'I debugged the memory leak and solved it.',
        },
        ownerUserId,
        UserRole.CANDIDATE,
      );

      expect(analysis).toBeDefined();
    });

    it('denies non-owner from analyzing another user session', async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerUserId,
      });
      prismaMock.mentorProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.analyzeStar(
          {
            sessionId,
            turnNumber: 1,
            questionText: 'Tell me about a time you solved a bug',
            candidateAnswer: 'I debugged the memory leak and solved it.',
          },
          otherUserId,
          UserRole.CANDIDATE,
        ),
      ).rejects.toThrow(
        new DomainException(
          ErrorCode.FORBIDDEN,
          'You do not have permission to analyze this interview session',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('allows admin to analyze any session', async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerUserId,
      });

      const analysis = await service.analyzeStar(
        {
          sessionId,
          turnNumber: 1,
          questionText: 'Tell me about a time you solved a bug',
          candidateAnswer: 'I debugged the memory leak and solved it.',
        },
        adminUserId,
        UserRole.ADMIN,
      );

      expect(analysis).toBeDefined();
    });

    it('allows authorized mentor to analyze candidate session', async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerUserId,
      });
      prismaMock.mentorProfile.findUnique.mockResolvedValue({
        id: 'mentor-prof-1',
        userId: mentorUserId,
      });
      prismaMock.liveSession.findFirst.mockResolvedValue({
        id: 'live-session-1',
        mentorId: 'mentor-prof-1',
        candidateId: ownerUserId,
        status: LiveSessionStatus.IN_PROGRESS,
      });

      const analysis = await service.analyzeStar(
        {
          sessionId,
          turnNumber: 1,
          questionText: 'Tell me about a time you solved a bug',
          candidateAnswer: 'I debugged the memory leak and solved it.',
        },
        mentorUserId,
        UserRole.CANDIDATE,
      );

      expect(analysis).toBeDefined();
    });
  });
});
