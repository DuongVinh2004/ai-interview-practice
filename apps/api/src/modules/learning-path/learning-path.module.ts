import { Module } from '@nestjs/common';
import { LearningPathService } from './learning-path.service';
import { LearningPathController } from './learning-path.controller';
import { LearningPathProcessor } from './learning-path.processor';
import { AiOrchestratorModule } from '../ai-orchestrator/ai-orchestrator.module';

@Module({
  imports: [AiOrchestratorModule],
  controllers: [LearningPathController],
  providers: [LearningPathService, LearningPathProcessor],
  exports: [LearningPathService],
})
export class LearningPathModule {}
