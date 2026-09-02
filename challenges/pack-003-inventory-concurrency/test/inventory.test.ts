import { InventoryService } from '../src/inventory.service';

describe('InventoryService', () => {
  it('should instantiate and be defined', () => {
    const service = new InventoryService();
    expect(service).toBeDefined();
  });
});
