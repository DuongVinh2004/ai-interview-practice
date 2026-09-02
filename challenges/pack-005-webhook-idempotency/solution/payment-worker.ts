export class PaymentWebhookWorker {
  async processWebhook(event: { id: string; amount: number; userId: string }, db: any) {
    const isInserted = await db.insertIdempotencyKey(event.id);
    if (!isInserted) {
      return; // Already processed, acknowledge and return cleanly
    }
    await db.creditBalance(event.userId, event.amount);
    await db.markOrderPaid(event.id);
  }
}
