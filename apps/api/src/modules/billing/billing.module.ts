import { Module, Global } from '@nestjs/common';
import { BillingService } from './billing.service';
import { UsageMeterService } from './usage-meter.service';
import { BillingController } from './billing.controller';
import { BillingWebhookController } from './webhook.controller';
import { MockBillingProvider } from './providers/mock-billing.provider';
import { StripeProvider } from './providers/stripe.provider';
import { PayosProvider } from './providers/payos.provider';
import { QuotaGuard } from './guards/quota.guard';

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
  ],
  exports: [BillingService, UsageMeterService, PayosProvider, QuotaGuard],
})
export class BillingModule {}
