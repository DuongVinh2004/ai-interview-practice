export class InventoryService {
  async reserveStock(productId: string, quantity: number, db: any) {
    const updated = await db.execute(
      'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
      [quantity, productId, quantity],
    );
    return updated.affectedRows > 0;
  }
}
