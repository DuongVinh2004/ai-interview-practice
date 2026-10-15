import { Module } from '@nestjs/common';
import { AudioOrchestratorService } from './audio-orchestrator.service';
import { AudioController } from './audio.controller';
import { OpenAiAudioProvider } from './providers/openai-audio.provider';
import { MockAudioProvider } from './providers/mock-audio.provider';
import { NineRouterAudioProvider } from './providers/ninerouter-audio.provider';

@Module({
  controllers: [AudioController],
  providers: [
    AudioOrchestratorService,
    OpenAiAudioProvider,
    MockAudioProvider,
    NineRouterAudioProvider,
  ],
  exports: [
    AudioOrchestratorService,
    OpenAiAudioProvider,
    MockAudioProvider,
    NineRouterAudioProvider,
  ],
})
export class AudioOrchestratorModule {}
