import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { UsageMeterService } from './usage-meter.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateCheckoutDto, CreatePayosCheckoutDto, ValidatePromoDto } from './dto/billing.dto';

@ApiTags('Billing & Subscriptions')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly usageMeter: UsageMeterService,
  ) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List all available subscription plans and pricing tiers' })
  async listPlans() {
    return this.billingService.listPlans();
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user active subscription and plan details' })
  async getSubscription(@CurrentUser('sub') userId: string) {
    return this.billingService.getSubscription(userId);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create checkout session for subscription upgrade' })
  async createCheckout(@CurrentUser('sub') userId: string, @Body() dto: CreateCheckoutDto) {
    return this.billingService.createCheckout(userId, {
      ...dto,
      billingCycle: dto.billingCycle || 'monthly',
    });
  }

  @Post('payos/checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create PayOS VietQR payment link for subscription upgrade' })
  async createPayosCheckout(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePayosCheckoutDto,
  ) {
    return this.billingService.createPayosPayment(userId, {
      planSlug: dto.planSlug,
      billingCycle: dto.billingCycle || 'monthly',
      returnUrl: dto.returnUrl,
      cancelUrl: dto.cancelUrl,
    });
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel current subscription at period end' })
  async cancelSubscription(@CurrentUser('sub') userId: string) {
    return this.billingService.cancelSubscription(userId);
  }

  @Get('usage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get monthly usage summary and remaining quotas' })
  async getUsageSummary(@CurrentUser('sub') userId: string) {
    return this.usageMeter.getUsageSummary(userId);
  }

  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List user invoice history' })
  async getInvoices(@CurrentUser('sub') userId: string) {
    return this.billingService.getInvoices(userId);
  }

  @Public()
  @Post('promo/validate')
  @ApiOperation({ summary: 'Validate discount promotional code' })
  async validatePromo(@Body() dto: ValidatePromoDto) {
    return this.billingService.validatePromoCode(dto.code);
  }
}
