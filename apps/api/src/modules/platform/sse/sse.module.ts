import { Global, Module } from '@nestjs/common';
import { SseService } from './sse.service';
import { SseTokenSecurityGuard } from './sse-token-security.guard';

@Global()
@Module({
  providers: [SseService, SseTokenSecurityGuard],
  exports: [SseService, SseTokenSecurityGuard],
})
export class SseModule {}
