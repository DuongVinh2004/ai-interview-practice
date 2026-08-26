import { Controller, Post, Body, Headers, Req, RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StripeProvider } from './providers/stripe.provider';
import { BillingService } from './billing.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Billing & Subscriptions')
@Controller('billing/webhooks')
export class BillingWebhookController {
  constructor(
    private readonly stripeProvider: StripeProvider,
    private readonly billingService: BillingService,
  ) {}

  @Public()
  @Post('stripe')
  @ApiOperation({ summary: 'Stripe webhook receiver for asynchronous subscription events' })
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<any>,
    @Body() payload: any,
    @Headers('stripe-signature') signature?: string,
  ) {
    const rawBodyString = req.rawBody ? req.rawBody.toString('utf8') : undefined;
    return this.stripeProvider.handleWebhook(payload, signature, rawBodyString);
  }

  @Public()
  @Post('payos')
  @ApiOperation({ summary: 'PayOS VietQR webhook receiver for payment completion confirmation' })
  async handlePayosWebhook(@Body() payload: any) {
    return this.billingService.handlePayosWebhook(payload);
  }
}
