import { QuestionBankEntitlementService } from '../services/question-bank-entitlement.service';

describe('QuestionBank Period Key Calculation', () => {
  let service: QuestionBankEntitlementService;

  beforeEach(() => {
    const mockPrisma: any = {};
    const mockBilling: any = {};
    service = new QuestionBankEntitlementService(mockPrisma, mockBilling);
  });

  it('computes monthly period key for free user with calendar reset', () => {
    const testDate = new Date('2026-08-15T10:00:00Z');
    const result = service.computeAccessPeriodKey(null, testDate);

    expect(result.periodKey).toBe('month_2026-08');
    expect(result.resetsAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('computes subscription period key for active subscriber', () => {
    const activeSub = {
      id: 'sub_12345',
      status: 'ACTIVE',
      currentPeriodStart: '2026-08-10T00:00:00Z',
      currentPeriodEnd: '2026-09-10T00:00:00Z',
    };

    const result = service.computeAccessPeriodKey(activeSub, new Date('2026-08-15T12:00:00Z'));

    expect(result.periodKey).toBe('sub_sub_12345_2026-08-10');
    expect(result.resetsAt).toBe('2026-09-10T00:00:00.000Z');
  });

  it('keeps a persisted free subscription in the monthly free period', () => {
    const result = service.computeAccessPeriodKey(
      {
        id: 'persisted-free-subscription',
        status: 'ACTIVE',
        plan: { slug: 'free' },
        currentPeriodStart: '2026-08-10T00:00:00Z',
        currentPeriodEnd: '2026-09-10T00:00:00Z',
      },
      new Date('2026-08-15T12:00:00Z'),
    );

    expect(result.periodKey).toBe('month_2026-08');
    expect(result.resetsAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('handles year rollover gracefully for free users', () => {
    const decDate = new Date('2026-12-31T23:59:59Z');
    const result = service.computeAccessPeriodKey(null, decDate);

    expect(result.periodKey).toBe('month_2026-12');
    expect(result.resetsAt).toBe('2027-01-01T00:00:00.000Z');
  });
});
