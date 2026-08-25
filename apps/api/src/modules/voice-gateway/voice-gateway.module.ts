import { Module } from '@nestjs/common';
import { VoiceStreamingGateway } from './gateways/voice-streaming.gateway';
import { VadEngineService } from './services/vad-engine.service';
import { MockVoiceProvider } from './providers/mock-voice.provider';
import { DeepgramSttProvider } from './providers/deepgram-stt.provider';
import { ElevenLabsTtsProvider } from './providers/elevenlabs-tts.provider';
import { SentenceChunkerService } from './services/sentence-chunker.service';
import { PlatformModule } from '../platform/platform.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PlatformModule, AuthModule],
  providers: [
    VoiceStreamingGateway,
    VadEngineService,
    MockVoiceProvider,
    DeepgramSttProvider,
    ElevenLabsTtsProvider,
    SentenceChunkerService,
  ],
  exports: [
    VoiceStreamingGateway,
    VadEngineService,
    MockVoiceProvider,
    DeepgramSttProvider,
    ElevenLabsTtsProvider,
    SentenceChunkerService,
  ],
})
export class VoiceGatewayModule {}
