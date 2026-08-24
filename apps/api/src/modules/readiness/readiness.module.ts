import { Module } from '@nestjs/common';
import { ReadinessController } from './readiness.controller';
import { ReadinessService } from './services/readiness.service';
import { WeightProfileService } from './services/weight-profile.service';
import { TierClassificationService } from './services/tier-classification.service';
import { VelocityService } from './services/velocity.service';

@Module({
  controllers: [ReadinessController],
  providers: [
    ReadinessService,
    WeightProfileService,
    TierClassificationService,
    VelocityService,
  ],
  exports: [
    ReadinessService,
    WeightProfileService,
    TierClassificationService,
    VelocityService,
  ],
})
export class ReadinessModule {}
