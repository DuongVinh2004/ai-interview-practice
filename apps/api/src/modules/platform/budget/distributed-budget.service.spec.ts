import { DistributedBudgetService } from './distributed-budget.service';

describe('DistributedBudgetService', () => {
  it('reserves budget atomically under one Redis day key', async () => {
    const evalMock = jest.fn().mockResolvedValue([1, 2_000_000]);
    const service = new DistributedBudgetService({
      getClient: () => ({ eval: evalMock }),
    } as any);

    const reservation = await service.reserve('ai-provider-global', 50, 2);

    expect(reservation).toEqual(expect.objectContaining({ reservedMicros: 2_000_000 }));
    expect(reservation?.key).toMatch(/^distributed-budget:ai-provider-global:\d{4}-\d{2}-\d{2}$/);
    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCRBY'"),
      1,
      reservation?.key,
      2_000_000,
      50_000_000,
      expect.any(Number),
    );
  });

  it('fails closed when the shared daily limit cannot accept a reservation', async () => {
    const service = new DistributedBudgetService({
      getClient: () => ({ eval: jest.fn().mockResolvedValue([0, 49_000_000]) }),
    } as any);

    await expect(service.reserve('ai-provider-global', 50, 2)).resolves.toBeNull();
  });

  it('releases the complete reservation after a definite provider failure', async () => {
    const evalMock = jest.fn().mockResolvedValue(0);
    const service = new DistributedBudgetService({
      getClient: () => ({ eval: evalMock }),
    } as any);

    await service.release({ key: 'distributed-budget:test:2026-08-29', reservedMicros: 2_000_000 });

    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('SET'"),
      1,
      'distributed-budget:test:2026-08-29',
      -2_000_000,
    );
  });

  it('reports the shared Redis counter rather than a process-local estimate', async () => {
    const getMock = jest.fn().mockResolvedValue('12500000');
    const service = new DistributedBudgetService({
      getClient: () => ({ get: getMock }),
    } as any);

    await expect(service.getCurrentUsd('ai-provider-global')).resolves.toBe(12.5);
    expect(getMock).toHaveBeenCalledWith(
      expect.stringMatching(/^distributed-budget:ai-provider-global:\d{4}-\d{2}-\d{2}$/),
    );
  });
});
