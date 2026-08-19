import { Module } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { InterviewController } from './interview.controller';
import { QuestionProcessor } from './processors/question.processor';
import { AiOrchestratorModule } from '../ai-orchestrator/ai-orchestrator.module';

@Module({
  imports: [AiOrchestratorModule],
  controllers: [InterviewController],
  providers: [InterviewService, QuestionProcessor],
  exports: [InterviewService],
})
export class InterviewModule {}
