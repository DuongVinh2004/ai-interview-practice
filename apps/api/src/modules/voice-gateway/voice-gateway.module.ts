import { Module } from '@nestjs/common';
import { VoiceStreamingGateway } from './gateways/voice-streaming.gateway';
import { VadEngineService } from './services/vad-engine.service';
import { MockVoiceProvider } from './providers/mock-voice.provider';
import { PlatformModule } from '../platform/platform.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PlatformModule, AuthModule],
  providers: [VoiceStreamingGateway, VadEngineService, MockVoiceProvider],
  exports: [VoiceStreamingGateway, VadEngineService, MockVoiceProvider],
})
export class VoiceGatewayModule {}
