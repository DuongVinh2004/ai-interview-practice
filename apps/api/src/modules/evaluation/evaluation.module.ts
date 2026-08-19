import { Module } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { EvaluationProcessor } from './evaluation.processor';
import { AiOrchestratorModule } from '../ai-orchestrator/ai-orchestrator.module';

@Module({
  imports: [AiOrchestratorModule],
  providers: [EvaluationService, EvaluationProcessor],
  exports: [EvaluationService],
})
export class EvaluationModule {}
