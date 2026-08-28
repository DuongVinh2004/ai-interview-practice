import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TenantService } from './services/tenant.service';
import { CohortService } from './services/cohort.service';
import { AssignmentService } from './services/assignment.service';
import { CohortAnalyticsService } from './services/cohort-analytics.service';
import { TenantRoleGuard } from './guards/tenant-role.guard';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';
import { TenantController } from './controllers/tenant.controller';
import { CohortController } from './controllers/cohort.controller';
import { AssignmentController } from './controllers/assignment.controller';
import { CohortAnalyticsController } from './controllers/cohort-analytics.controller';
import { CohortAccessPolicy } from './policies/cohort-access.policy';

@Module({
  controllers: [
    TenantController,
    CohortController,
    AssignmentController,
    CohortAnalyticsController,
  ],
  providers: [
    TenantService,
    CohortService,
    AssignmentService,
    CohortAnalyticsService,
    TenantRoleGuard,
    TenantContextMiddleware,
    CohortAccessPolicy,
  ],
  exports: [
    TenantService,
    CohortService,
    AssignmentService,
    CohortAnalyticsService,
    TenantRoleGuard,
    CohortAccessPolicy,
  ],
})
export class B2bModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes(
        { path: 'b2b/*', method: RequestMethod.ALL },
        { path: 'tenants/*', method: RequestMethod.ALL },
      );
  }
}
