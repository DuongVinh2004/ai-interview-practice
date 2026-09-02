export class PaymentWebhookWorker {
  async processWebhook(event: { id: string; amount: number; userId: string }, db: any) {
    // BUG: Missing idempotency check, creates duplicate credits on retry!
    await db.creditBalance(event.userId, event.amount);
    await db.markOrderPaid(event.id);
  }
}
