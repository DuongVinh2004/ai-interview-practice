import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../platform/prisma/prisma.service';
import { EntitlementReservationService } from './entitlement-reservation.service';

/**
 * Resolves only safe abandoned reservations. A reservation marked as dispatched
 * may already have reached an external provider, so it is retained for manual
 * reconciliation rather than automatically refunded.
 */
@Injectable()
export class EntitlementReconciliationService {
  private readonly logger = new Logger(EntitlementReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: EntitlementReservationService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcileExpiredReservations(): Promise<void> {
    const expired = await this.prisma.entitlementReservation.findMany({
      where: { state: 'RESERVED', expiresAt: { lte: new Date() } },
      select: { id: true, providerDispatchStartedAt: true },
      take: 100,
    });

    for (const reservation of expired) {
      try {
        if (!reservation.providerDispatchStartedAt) {
          await this.reservations.release(reservation.id, 'expired_before_provider_dispatch');
          continue;
        }
        await this.reservations.markForReconciliation(
          reservation.id,
          'expired_after_provider_dispatch',
          { detectedBy: 'entitlement-reconciliation-cron' },
        );
      } catch (error: any) {
        this.logger.error(
          `Unable to reconcile expired entitlement reservation ${reservation.id}: ${error.message}`,
        );
      }
    }
  }
}
