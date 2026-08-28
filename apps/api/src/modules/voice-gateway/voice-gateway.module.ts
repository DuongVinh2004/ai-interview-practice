import { Module, forwardRef } from '@nestjs/common';
import { VoiceStreamingGateway } from './gateways/voice-streaming.gateway';
import { VoiceGatewayController } from './voice-gateway.controller';
import { VadEngineService } from './services/vad-engine.service';
import { MockVoiceProvider } from './providers/mock-voice.provider';
import { DeepgramSttProvider } from './providers/deepgram-stt.provider';
import { ElevenLabsTtsProvider } from './providers/elevenlabs-tts.provider';
import { SentenceChunkerService } from './services/sentence-chunker.service';
import { PlatformModule } from '../platform/platform.module';
import { AuthModule } from '../auth/auth.module';
import { InterviewModule } from '../interview/interview.module';

@Module({
  imports: [PlatformModule, AuthModule, forwardRef(() => InterviewModule)],
  controllers: [VoiceGatewayController],
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
