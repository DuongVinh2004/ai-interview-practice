import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { EvalHarnessService } from './eval-harness.service';
import { AiOrchestratorModule } from '../ai-orchestrator/ai-orchestrator.module';

@Module({
  imports: [AiOrchestratorModule],
  controllers: [AdminController],
  providers: [AdminService, EvalHarnessService],
  exports: [AdminService, EvalHarnessService],
})
export class AdminModule {}
