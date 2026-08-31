import { Module } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { EvaluationProcessor } from './evaluation.processor';
import { AiOrchestratorModule } from '../ai-orchestrator/ai-orchestrator.module';
import { isWorkerProcess } from '../platform/process-role';

@Module({
  imports: [AiOrchestratorModule],
  providers: [EvaluationService, ...(isWorkerProcess() ? [EvaluationProcessor] : [])],
  exports: [EvaluationService],
})
export class EvaluationModule {}
