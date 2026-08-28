import { ArenaAntiCheatService } from './arena-anti-cheat.service';
import { PrismaService } from '../../platform/prisma/prisma.service';

describe('ArenaAntiCheatService', () => {
  let service: ArenaAntiCheatService;
  let prisma: {
    arenaSession: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      arenaSession: {
        findUnique: jest.fn(),
      },
    };
    service = new ArenaAntiCheatService(prisma as unknown as PrismaService);
  });

  it('flags session as suspicious when unnatural speed and burst paste are detected', async () => {
    prisma.arenaSession.findUnique.mockResolvedValue({
      id: 's-cheat-1',
      startedAt: new Date('2026-08-28T12:00:00.000Z'),
      submittedAt: new Date('2026-08-28T12:01:00.000Z'), // 60 seconds
      challengeVersion: {
        challenge: { difficulty: 4 },
      },
      actionEvents: [
        {
          sequence: 1,
          metadata: { pastedCharCount: 1200 },
        },
      ],
      executionRuns: [],
    });

    const report = await service.analyzeSession('s-cheat-1');
    expect(report.isSuspicious).toBe(true);
    expect(report.riskScore).toBeGreaterThanOrEqual(60);
    expect(report.flags).toHaveLength(3);
    expect(report.flags.some((f) => f.ruleId === 'UNNATURAL_COMPLETION_SPEED')).toBe(true);
    expect(report.flags.some((f) => f.ruleId === 'BURST_PASTE_DETECTED')).toBe(true);
  });

  it('marks normal candidate session with multiple test runs and realistic timing as safe', async () => {
    prisma.arenaSession.findUnique.mockResolvedValue({
      id: 's-safe-1',
      startedAt: new Date('2026-08-28T12:00:00.000Z'),
      submittedAt: new Date('2026-08-28T12:25:00.000Z'), // 25 minutes
      challengeVersion: {
        challenge: { difficulty: 3 },
      },
      actionEvents: [
        {
          sequence: 1,
          metadata: { pastedCharCount: 40 },
        },
      ],
      executionRuns: [{ id: 'run-1' }, { id: 'run-2' }],
    });

    const report = await service.analyzeSession('s-safe-1');
    expect(report.isSuspicious).toBe(false);
    expect(report.riskScore).toBe(0);
    expect(report.flags).toHaveLength(0);
  });
});
