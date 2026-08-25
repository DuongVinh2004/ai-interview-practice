import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { UsageMeterService } from './usage-meter.service';
import { BillingController } from './billing.controller';
import { BillingWebhookController } from './webhook.controller';
import { MockBillingProvider } from './providers/mock-billing.provider';
import { StripeProvider } from './providers/stripe.provider';
import { QuotaGuard } from './guards/quota.guard';

@Module({
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService, UsageMeterService, MockBillingProvider, StripeProvider, QuotaGuard],
  exports: [BillingService, UsageMeterService, QuotaGuard],
})
export class BillingModule {}
