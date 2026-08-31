import { Module } from '@nestjs/common';
import { LearningPathService } from './learning-path.service';
import { LearningPathController } from './learning-path.controller';
import { LearningPathProcessor } from './learning-path.processor';
import { AiOrchestratorModule } from '../ai-orchestrator/ai-orchestrator.module';
import { isWorkerProcess } from '../platform/process-role';

@Module({
  imports: [AiOrchestratorModule],
  controllers: [LearningPathController],
  providers: [LearningPathService, ...(isWorkerProcess() ? [LearningPathProcessor] : [])],
  exports: [LearningPathService],
})
export class LearningPathModule {}
