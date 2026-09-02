import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsIn,
  IsOptional,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isAllowedRedirectUrl', async: false })
export class IsAllowedRedirectUrlConstraint implements ValidatorConstraintInterface {
  validate(url: string) {
    if (!url) return true;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }
      const allowedOrigins = (
        process.env.ALLOWED_REDIRECT_ORIGINS ||
        'https://ai-interview.dev,http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173'
      )
        .split(',')
        .map(o => o.trim());

      return allowedOrigins.includes(parsed.origin);
    } catch {
      return false;
    }
  }

  defaultMessage() {
    return 'Redirect URL origin must be in the allowed origins allowlist';
  }
}

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
  @Validate(IsAllowedRedirectUrlConstraint)
  @IsOptional()
  successUrl?: string;

  @ApiPropertyOptional({ example: 'https://ai-interview.dev/billing' })
  @Validate(IsAllowedRedirectUrlConstraint)
  @IsOptional()
  cancelUrl?: string;
}

export class CreatePayosCheckoutDto {
  @ApiProperty({ example: 'pro' })
  @IsString()
  @IsNotEmpty()
  planSlug!: string;

  @ApiPropertyOptional({ enum: ['monthly', 'yearly'], default: 'monthly' })
  @IsIn(['monthly', 'yearly'])
  @IsOptional()
  billingCycle?: 'monthly' | 'yearly';

  @ApiPropertyOptional({ example: 'https://ai-interview.dev/billing?success=true' })
  @Validate(IsAllowedRedirectUrlConstraint)
  @IsOptional()
  returnUrl?: string;

  @ApiPropertyOptional({ example: 'https://ai-interview.dev/billing?canceled=true' })
  @Validate(IsAllowedRedirectUrlConstraint)
  @IsOptional()
  cancelUrl?: string;
}

export class ValidatePromoDto {
  @ApiProperty({ example: 'PROMO20' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
