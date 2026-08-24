import { Module } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { ProviderRouterService } from './router/provider-router.service';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { MockAiProvider } from './providers/mock-ai.provider';
import { PromptRegistryService } from './prompt-registry/prompt-registry.service';
import { PromptRendererService } from './prompt-engine/prompt-renderer.service';
import { AiSecurityFilterService } from './security/ai-security-filter.service';
import { SemanticCacheService } from './cache/semantic-cache.service';

@Module({
  providers: [
    AiOrchestratorService,
    ProviderRouterService,
    SemanticCacheService,
    GeminiProvider,
    OpenAiProvider,
    AnthropicProvider,
    MockAiProvider,
    PromptRegistryService,
    PromptRendererService,
    AiSecurityFilterService,
  ],
  exports: [
    AiOrchestratorService,
    ProviderRouterService,
    SemanticCacheService,
    GeminiProvider,
    OpenAiProvider,
    AnthropicProvider,
    MockAiProvider,
    PromptRegistryService,
    PromptRendererService,
    AiSecurityFilterService,
  ],
})
export class AiOrchestratorModule {}
