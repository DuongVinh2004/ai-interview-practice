import { Module } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { InterviewController } from './interview.controller';
import { QuestionProcessor } from './processors/question.processor';
import { AiOrchestratorModule } from '../ai-orchestrator/ai-orchestrator.module';
import { BehavioralService } from './behavioral/behavioral.service';
import { BehavioralController } from './behavioral/behavioral.controller';

import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AiOrchestratorModule, AuthModule],
  controllers: [InterviewController, BehavioralController],
  providers: [InterviewService, QuestionProcessor, BehavioralService],
  exports: [InterviewService, BehavioralService],
})
export class InterviewModule {}
