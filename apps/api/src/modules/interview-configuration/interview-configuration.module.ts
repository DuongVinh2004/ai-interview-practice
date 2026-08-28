import { Module, forwardRef } from '@nestjs/common';
import { InterviewConfigurationController } from './interview-configuration.controller';
import { InterviewConfigurationService } from './interview-configuration.service';
import { SetupDraftController } from './setup-draft.controller';
import { SetupDraftService } from './setup-draft.service';
import { PrismaModule } from '../platform/prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';

@Module({
  imports: [PrismaModule, TaxonomyModule, forwardRef(() => BillingModule)],
  controllers: [InterviewConfigurationController, SetupDraftController],
  providers: [InterviewConfigurationService, SetupDraftService],
  exports: [InterviewConfigurationService, SetupDraftService],
})
export class InterviewConfigurationModule {}
