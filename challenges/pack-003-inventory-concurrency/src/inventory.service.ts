export class InventoryService {
  async reserveStock(productId: string, quantity: number, db: any) {
    // BUG: Check-then-act race condition!
    const product = await db.findOne('Product', productId);
    if (product.stock >= quantity) {
      product.stock -= quantity;
      await db.update('Product', productId, { stock: product.stock });
      return true;
    }
    return false;
  }
}
