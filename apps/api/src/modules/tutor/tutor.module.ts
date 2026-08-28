import { Module } from '@nestjs/common';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';
import { PlatformModule } from '../platform/platform.module';
import { AiOrchestratorModule } from '../ai-orchestrator/ai-orchestrator.module';

@Module({
  imports: [PlatformModule, AiOrchestratorModule],
  controllers: [TutorController],
  providers: [TutorService],
  exports: [TutorService],
})
export class TutorModule {}
