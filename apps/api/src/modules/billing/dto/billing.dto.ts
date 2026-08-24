import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn, IsUrl, IsOptional } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({ example: 'pro' })
  @IsString()
  @IsNotEmpty()
  planSlug!: string;

  @ApiPropertyOptional({ enum: ['monthly', 'yearly'], default: 'monthly' })
  @IsIn(['monthly', 'yearly'])
  @IsOptional()
  billingCycle?: 'monthly' | 'yearly';

  @ApiPropertyOptional({ example: 'https://ai-interview.dev/billing/success' })
  @IsUrl({ require_tld: false })
  @IsOptional()
  successUrl?: string;

  @ApiPropertyOptional({ example: 'https://ai-interview.dev/billing' })
  @IsUrl({ require_tld: false })
  @IsOptional()
  cancelUrl?: string;
}

export class ValidatePromoDto {
  @ApiProperty({ example: 'PROMO20' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
