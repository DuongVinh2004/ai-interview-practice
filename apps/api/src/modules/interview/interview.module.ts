import { Module } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { InterviewController } from './interview.controller';
import { QuestionProcessor } from './processors/question.processor';
import { AiOrchestratorModule } from '../ai-orchestrator/ai-orchestrator.module';
import { BehavioralService } from './behavioral/behavioral.service';
import { BehavioralController } from './behavioral/behavioral.controller';
import { AuthModule } from '../auth/auth.module';
import { InterviewConfigurationModule } from '../interview-configuration/interview-configuration.module';
import { MentorModule } from '../mentor/mentor.module';
import { isWorkerProcess } from '../platform/process-role';

@Module({
  imports: [AiOrchestratorModule, AuthModule, InterviewConfigurationModule, MentorModule],
  controllers: [InterviewController, BehavioralController],
  providers: [
    InterviewService,
    BehavioralService,
    ...(isWorkerProcess() ? [QuestionProcessor] : []),
  ],
  exports: [InterviewService, BehavioralService],
})
export class InterviewModule {}
