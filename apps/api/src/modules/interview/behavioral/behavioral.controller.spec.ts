import { Test, TestingModule } from '@nestjs/testing';
import { BehavioralController, AnalyzeStarDto } from './behavioral.controller';
import { BehavioralService } from './behavioral.service';
import { UserRole } from '@ai-interview/contracts';

describe('BehavioralController', () => {
  let controller: BehavioralController;
  let behavioralServiceMock: {
    analyzeStar: jest.Mock;
    listCompetencies: jest.Mock;
    getStarEvaluationReport: jest.Mock;
  };

  const userId = '11111111-1111-4111-a111-111111111111';
  const answerId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  const userRole = UserRole.CANDIDATE;

  beforeEach(async () => {
    behavioralServiceMock = {
      analyzeStar: jest.fn().mockResolvedValue({ actionNeeded: 'COMPLETE' }),
      listCompetencies: jest.fn().mockResolvedValue([]),
      getStarEvaluationReport: jest.fn().mockResolvedValue({ id: 'report-1', answerId }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BehavioralController],
      providers: [
        {
          provide: BehavioralService,
          useValue: behavioralServiceMock,
        },
      ],
    }).compile();

    controller = module.get<BehavioralController>(BehavioralController);
  });

  it('should delegate analyzeStar with userId and userRole to service', async () => {
    const dto: AnalyzeStarDto = {
      sessionId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      turnNumber: 1,
      questionText: 'Tell me about a time you solved a bug',
      candidateAnswer: 'I fixed it.',
    };

    const result = await controller.analyzeStar(userId, userRole, dto);

    expect(result).toEqual({ actionNeeded: 'COMPLETE' });
    expect(behavioralServiceMock.analyzeStar).toHaveBeenCalledWith(dto, userId, userRole);
  });

  it('should delegate listCompetencies to service', async () => {
    const result = await controller.listCompetencies();

    expect(result).toEqual([]);
    expect(behavioralServiceMock.listCompetencies).toHaveBeenCalled();
  });

  it('should delegate getStarReport with authenticated userId and role to service', async () => {
    const result = await controller.getStarReport(userId, userRole, answerId);

    expect(result).toEqual({ id: 'report-1', answerId });
    expect(behavioralServiceMock.getStarEvaluationReport).toHaveBeenCalledWith(
      userId,
      userRole,
      answerId,
    );
  });
});
