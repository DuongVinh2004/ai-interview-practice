import { VisionEntitlementService } from './vision-entitlement.service';

describe('VisionEntitlementService', () => {
  const result = {
    overallScore: 8,
    requirementsScore: 8,
    highLevelScore: 8,
    componentDetailScore: 8,
    scalabilityScore: 8,
    dataModelScore: 8,
    summary: 'ok',
    feedback: 'ok',
    detectedComponents: [],
    strengths: [],
    bottlenecks: [],
    recommendations: [],
    annotations: [],
    usageTokens: 2_500,
  };

  it('reserves before calling a paid provider and commits provider-reported token usage', async () => {
    const reservations = {
      reserve: jest.fn().mockResolvedValue({
        id: 'reservation_1',
        state: 'RESERVED',
        isNewReservation: true,
      }),
      markProviderDispatchStarted: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue({ state: 'COMMITTED' }),
      release: jest.fn(),
      markForReconciliation: jest.fn(),
    };
    const provider = { name: 'openai', evaluateDiagram: jest.fn().mockResolvedValue(result) };
    const service = new VisionEntitlementService(reservations as any);

    await service.evaluate({
      userId: 'user_1',
      idempotencyKey: 'vision-1',
      operationType: 'system-design.analyze',
      interviewId: 'interview_1',
      provider,
      options: { imageBase64: 'data:image/png;base64,AAAA' },
    });

    expect(reservations.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      provider.evaluateDiagram.mock.invocationCallOrder[0],
    );
    expect(reservations.commit).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 'reservation_1', actualQuantity: 2_500 }),
    );
  });

  it('does not call a paid provider when the idempotency key replays a prior reservation', async () => {
    const reservations = {
      reserve: jest.fn().mockResolvedValue({
        id: 'reservation_1',
        state: 'RESERVED',
        isNewReservation: false,
      }),
      markProviderDispatchStarted: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn(),
      release: jest.fn(),
      markForReconciliation: jest.fn(),
    };
    const provider = { name: 'gemini', evaluateDiagram: jest.fn() };
    const service = new VisionEntitlementService(reservations as any);

    await expect(
      service.evaluate({
        userId: 'user_1',
        idempotencyKey: 'vision-1',
        operationType: 'system-design.evaluate',
        interviewId: 'interview_1',
        provider,
        options: { imageBase64: 'data:image/png;base64,AAAA' },
      }),
    ).rejects.toThrow(/already been processed/);
    expect(provider.evaluateDiagram).not.toHaveBeenCalled();
  });
});
