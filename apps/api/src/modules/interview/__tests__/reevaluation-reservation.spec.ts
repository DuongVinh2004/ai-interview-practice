import { InterviewService } from '../interview.service';

describe('candidate re-evaluation reservation', () => {
  it('counts committed and pending attempts inside one serializable transaction', async () => {
    const prisma: any = {
      evaluationRun: { count: jest.fn().mockResolvedValue(1) },
      evaluationRunReservation: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
      },
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };
    const service = new InterviewService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const id = await (service as any).reserveCandidateReevaluation('evaluation-1', 'user-1');

    expect(id).toBe('reservation-1');
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
    expect(prisma.evaluationRunReservation.create).toHaveBeenCalledTimes(1);
  });

  it('rejects before provider execution when completed plus pending attempts reach the cap', async () => {
    const prisma: any = {
      evaluationRun: { count: jest.fn().mockResolvedValue(1) },
      evaluationRunReservation: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn(),
      },
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };
    const service = new InterviewService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      (service as any).reserveCandidateReevaluation('evaluation-1', 'user-1'),
    ).rejects.toMatchObject({ status: 429 });
    expect(prisma.evaluationRunReservation.create).not.toHaveBeenCalled();
  });
});
