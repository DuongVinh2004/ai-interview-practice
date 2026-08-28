import { QuestionBankEntitlementService } from '../services/question-bank-entitlement.service';

describe('QuestionBank Entitlement Resolver', () => {
  let service: QuestionBankEntitlementService;
  let mockPrisma: any;
  let mockBilling: any;

  beforeEach(() => {
    mockPrisma = {
      questionBankUsageLedger: {
        aggregate: jest.fn(),
      },
      questionAnswerAccessGrant: {
        findUnique: jest.fn(),
      },
    };
    mockBilling = {
      getSubscription: jest.fn(),
    };
    service = new QuestionBankEntitlementService(mockPrisma, mockBilling);
  });

  it('resolves default free plan with 5 reveals per month', async () => {
    mockBilling.getSubscription.mockResolvedValue(null);
    mockPrisma.questionBankUsageLedger.aggregate.mockResolvedValue({
      _sum: { quantity: 2 },
    });

    const result = await service.getEffectiveEntitlement('user_1');

    expect(result.planSlug).toBe('free');
    expect(result.revealsLimit).toBe(5);
    expect(result.revealsUsed).toBe(2);
    expect(result.revealsRemaining).toBe(3);
    expect(result.advancedFiltersAllowed).toBe(false);
  });

  it('resolves pro plan with 50 reveals and advanced features', async () => {
    mockBilling.getSubscription.mockResolvedValue({
      id: 'sub_pro_1',
      status: 'ACTIVE',
      plan: { slug: 'pro', name: 'Pro Plan' },
      currentPeriodStart: '2026-08-01T00:00:00Z',
      currentPeriodEnd: '2026-09-01T00:00:00Z',
    });
    mockPrisma.questionBankUsageLedger.aggregate.mockResolvedValue({
      _sum: { quantity: 15 },
    });

    const result = await service.getEffectiveEntitlement('user_pro');

    expect(result.planSlug).toBe('pro');
    expect(result.revealsLimit).toBe(50);
    expect(result.revealsUsed).toBe(15);
    expect(result.revealsRemaining).toBe(35);
    expect(result.advancedFiltersAllowed).toBe(true);
    expect(result.expertContentAllowed).toBe(true);
    expect(result.rubricsAllowed).toBe(true);
  });

  it('resolves enterprise plan with unlimited reveals', async () => {
    mockBilling.getSubscription.mockResolvedValue({
      id: 'sub_ent_1',
      status: 'ACTIVE',
      plan: { slug: 'enterprise', name: 'Enterprise Plan' },
    });
    mockPrisma.questionBankUsageLedger.aggregate.mockResolvedValue({
      _sum: { quantity: 999 },
    });

    const result = await service.getEffectiveEntitlement('user_ent');

    expect(result.planSlug).toBe('enterprise');
    expect(result.revealsLimit).toBe('unlimited');
    expect(result.revealsRemaining).toBe('unlimited');
  });

  it('blocks reveal when quota is exhausted', async () => {
    mockBilling.getSubscription.mockResolvedValue(null);
    mockPrisma.questionBankUsageLedger.aggregate.mockResolvedValue({
      _sum: { quantity: 5 }, // 5 out of 5 used
    });
    mockPrisma.questionAnswerAccessGrant.findUnique.mockResolvedValue(null);

    const check = await service.canRevealAnswer('user_free', 'q_1', 'ans_1');

    expect(check.allowed).toBe(false);
    expect(check.existingGrant).toBe(false);
    expect(check.reason).toContain('exhausted');
  });

  it('allows reveal when existing grant already exists even if quota is full', async () => {
    mockBilling.getSubscription.mockResolvedValue(null);
    mockPrisma.questionBankUsageLedger.aggregate.mockResolvedValue({
      _sum: { quantity: 5 },
    });
    mockPrisma.questionAnswerAccessGrant.findUnique.mockResolvedValue({
      id: 'grant_existing',
      userId: 'user_free',
    });

    const check = await service.canRevealAnswer('user_free', 'q_1', 'ans_1');

    expect(check.allowed).toBe(true);
    expect(check.existingGrant).toBe(true);
  });
});
