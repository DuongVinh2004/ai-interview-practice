import { Controller, Post, Body, Headers, Req, RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StripeProvider } from './providers/stripe.provider';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Billing & Subscriptions')
@Controller('billing/webhooks')
export class BillingWebhookController {
  constructor(private readonly stripeProvider: StripeProvider) {}

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
}
