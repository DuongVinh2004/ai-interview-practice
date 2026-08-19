import { Module } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { MockAiProvider } from './providers/mock-ai.provider';
import { ExternalAiProvider } from './providers/external-ai.provider';
import { PromptRegistryService } from './prompt-registry/prompt-registry.service';

@Module({
  providers: [AiOrchestratorService, MockAiProvider, ExternalAiProvider, PromptRegistryService],
  exports: [AiOrchestratorService],
})
export class AiOrchestratorModule {}
