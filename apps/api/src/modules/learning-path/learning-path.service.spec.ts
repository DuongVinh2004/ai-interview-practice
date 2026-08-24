import { Test, TestingModule } from '@nestjs/testing';
import { LearningPathService } from './learning-path.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueName, LearningPathStatus, UserRole } from '@ai-interview/contracts';

describe('LearningPathService', () => {
  let service: LearningPathService;
  let prisma: any;
  let queue: any;

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    state: 'COMPLETED',
    learningPath: {
      id: 'lp-123',
      sessionId: 'session-123',
      status: LearningPathStatus.READY,
    },
  };

  const mockItem = {
    id: 'item-1',
    learningPathId: 'lp-123',
    gap: 'Lacks concurrency isolation details',
    topic: 'Database Locking & Isolation',
    priority: 'HIGH',
    recommendedAction: 'Study PostgreSQL READ COMMITTED vs REPEATABLE READ',
    searchKeywords: ['postgresql', 'isolation'],
    order: 0,
    isCompleted: false,
    completedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      interviewSession: {
        findUnique: jest.fn(),
      },
      learningPath: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      learningPathItem: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    queue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningPathService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(QueueName.LEARNING_PATH), useValue: queue },
      ],
    }).compile();

    service = module.get<LearningPathService>(LearningPathService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('updates item completion status and creates an audit log', async () => {
    prisma.interviewSession.findUnique.mockResolvedValue(mockSession);
    prisma.learningPathItem.findUnique.mockResolvedValue(mockItem);
    prisma.learningPathItem.update.mockResolvedValue({
      ...mockItem,
      isCompleted: true,
      completedAt: new Date('2026-08-24T16:00:00Z'),
    });

    const result = await service.updateItemStatus('user-123', 'session-123', 'item-1', true);

    expect(result.isCompleted).toBe(true);
    expect(result.completedAt).toBeDefined();
    expect(prisma.learningPathItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: expect.objectContaining({ isCompleted: true }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('aggregates user learning goals across sessions', async () => {
    prisma.learningPath.findMany.mockResolvedValue([
      {
        id: 'lp-1',
        sessionId: 'session-1',
        createdAt: new Date('2026-08-24T12:00:00Z'),
        session: {
          id: 'session-1',
          jobRole: { name: 'Backend Engineer' },
          seniorityLevel: { name: 'Senior' },
          completedAt: new Date(),
        },
        items: [
          { ...mockItem, id: 'item-1', isCompleted: true, completedAt: new Date() },
          { ...mockItem, id: 'item-2', topic: 'Circuit Breakers', isCompleted: false },
        ],
      },
    ]);

    const result = await service.getMyLearningGoals('user-123');

    expect(result.totalGoals).toBe(2);
    expect(result.completedGoals).toBe(1);
    expect(result.completionRate).toBe(50);
    expect(result.goals).toHaveLength(2);
  });
});
