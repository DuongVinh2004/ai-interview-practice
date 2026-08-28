import { Module, Global } from '@nestjs/common';
import { BillingService } from './billing.service';
import { UsageMeterService } from './usage-meter.service';
import { BillingController } from './billing.controller';
import { BillingWebhookController } from './webhook.controller';
import { MockBillingProvider } from './providers/mock-billing.provider';
import { StripeProvider } from './providers/stripe.provider';
import { PayosProvider } from './providers/payos.provider';
import { QuotaGuard } from './guards/quota.guard';
import { EntitlementReservationService } from './entitlement-reservation.service';
import { EntitlementReconciliationService } from './entitlement-reconciliation.service';

@Global()
@Module({
  controllers: [BillingController, BillingWebhookController],
  providers: [
    BillingService,
    UsageMeterService,
    MockBillingProvider,
    StripeProvider,
    PayosProvider,
    QuotaGuard,
    EntitlementReservationService,
    EntitlementReconciliationService,
  ],
  exports: [
    BillingService,
    UsageMeterService,
    PayosProvider,
    QuotaGuard,
    EntitlementReservationService,
  ],
})
export class BillingModule {}
