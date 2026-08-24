import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PlatformModule } from './modules/platform/platform.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfileModule } from './modules/profile/profile.module';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module';
import { AiOrchestratorModule } from './modules/ai-orchestrator/ai-orchestrator.module';
import { AudioOrchestratorModule } from './modules/audio-orchestrator/audio-orchestrator.module';
import { InterviewModule } from './modules/interview/interview.module';
import { EvaluationModule } from './modules/evaluation/evaluation.module';
import { LearningPathModule } from './modules/learning-path/learning-path.module';
import { HistoryReportModule } from './modules/history-report/history-report.module';
import { ShareModule } from './modules/share/share.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AdminModule } from './modules/admin/admin.module';
import { CodeExecutionModule } from './modules/code-execution/code-execution.module';
import { BillingModule } from './modules/billing/billing.module';
import { DocumentParserModule } from './modules/document-parser/document-parser.module';
import { TutorModule } from './modules/tutor/tutor.module';
import { FlashcardModule } from './modules/flashcards/flashcard.module';
import { VoiceGatewayModule } from './modules/voice-gateway/voice-gateway.module';
import { SkillGraphModule } from './modules/skill-graph/skill-graph.module';
import { SystemDesignModule } from './modules/system-design/system-design.module';
import { ReadinessModule } from './modules/readiness/readiness.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { MentorModule } from './modules/mentor/mentor.module';
import { B2bModule } from './modules/b2b/b2b.module';
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
    AudioOrchestratorModule,
    InterviewModule,
    EvaluationModule,
    LearningPathModule,
    HistoryReportModule,
    ShareModule,
    AnalyticsModule,
    AdminModule,
    CodeExecutionModule,
    BillingModule,
    DocumentParserModule,
    TutorModule,
    FlashcardModule,
    VoiceGatewayModule,
    SkillGraphModule,
    SystemDesignModule,
    ReadinessModule,
    PortfolioModule,
    MentorModule,
    B2bModule,
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
