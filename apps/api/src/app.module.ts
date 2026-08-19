import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PlatformModule } from './modules/platform/platform.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfileModule } from './modules/profile/profile.module';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module';
import { AiOrchestratorModule } from './modules/ai-orchestrator/ai-orchestrator.module';
import { InterviewModule } from './modules/interview/interview.module';
import { EvaluationModule } from './modules/evaluation/evaluation.module';
import { LearningPathModule } from './modules/learning-path/learning-path.module';
import { HistoryReportModule } from './modules/history-report/history-report.module';
import { AdminModule } from './modules/admin/admin.module';
import { AllExceptionsFilter } from './modules/platform/filters/all-exceptions.filter';
import { TransformInterceptor } from './modules/platform/interceptors/transform.interceptor';
import { LoggingInterceptor } from './modules/platform/interceptors/logging.interceptor';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per min
      },
    ]),
    PlatformModule,
    AuthModule,
    ProfileModule,
    TaxonomyModule,
    AiOrchestratorModule,
    InterviewModule,
    EvaluationModule,
    LearningPathModule,
    HistoryReportModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
