import { Module } from '@nestjs/common';
import { TaxonomyService } from './taxonomy.service';
import { TaxonomyMatcherService } from './taxonomy-matcher.service';
import { TaxonomyController } from './taxonomy.controller';

@Module({
  controllers: [TaxonomyController],
  providers: [TaxonomyService, TaxonomyMatcherService],
  exports: [TaxonomyService, TaxonomyMatcherService],
})
export class TaxonomyModule {}
