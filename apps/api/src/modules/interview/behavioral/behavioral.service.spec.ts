import { Test, TestingModule } from '@nestjs/testing';
import { BehavioralService } from './behavioral.service';
import { PrismaService } from '../../platform/prisma/prisma.service';

describe('BehavioralService (F007)', () => {
  let service: BehavioralService;
  let prismaMock: any;

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
      starEvaluation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'star-eval-1',
          answerId: 'ans-1',
          situationScore: 3.5,
          taskScore: 3.5,
          actionScore: 4.0,
          resultScore: 3.5,
          structureScore: 2.0,
          totalScore: 9.2,
          feedback: 'Outstanding STAR structure',
          probingQuestionsAsked: [],
          createdAt: new Date(),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BehavioralService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<BehavioralService>(BehavioralService);
  });

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
