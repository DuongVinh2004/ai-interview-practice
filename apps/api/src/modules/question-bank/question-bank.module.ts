import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { QuestionBankController } from './controllers/question-bank.controller';
import { AdminQuestionBankController } from './controllers/admin-question-bank.controller';
import { QuestionBankService } from './services/question-bank.service';
import { QuestionBankEntitlementService } from './services/question-bank-entitlement.service';

@Module({
  imports: [PlatformModule, AuthModule, BillingModule, TaxonomyModule],
  controllers: [QuestionBankController, AdminQuestionBankController],
  // BillingModule owns the reservation service. Reusing that exported provider
  // keeps all paid-capability callers on the same durable quota boundary.
  providers: [QuestionBankService, QuestionBankEntitlementService],
  exports: [QuestionBankService, QuestionBankEntitlementService],
})
export class QuestionBankModule {}
