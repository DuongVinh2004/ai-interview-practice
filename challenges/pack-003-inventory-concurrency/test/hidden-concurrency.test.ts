import { InventoryService } from '../src/inventory.service';

describe('Hidden Concurrency Reservation Verification', () => {
  it('executes atomic update query to guarantee no oversell', async () => {
    const service = new InventoryService();
    const mockDb = {
      execute: jest.fn().mockResolvedValue({ affectedRows: 1 }),
    };

    const success = await service.reserveStock('prod-1', 5, mockDb);

    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?'),
      [5, 'prod-1', 5],
    );
    expect(success).toBe(true);
  });
});
