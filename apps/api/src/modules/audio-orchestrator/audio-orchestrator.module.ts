import { Module } from '@nestjs/common';
import { AudioOrchestratorService } from './audio-orchestrator.service';
import { AudioController } from './audio.controller';
import { OpenAiAudioProvider } from './providers/openai-audio.provider';
import { MockAudioProvider } from './providers/mock-audio.provider';

@Module({
  controllers: [AudioController],
  providers: [AudioOrchestratorService, OpenAiAudioProvider, MockAudioProvider],
  exports: [AudioOrchestratorService, OpenAiAudioProvider, MockAudioProvider],
})
export class AudioOrchestratorModule {}
