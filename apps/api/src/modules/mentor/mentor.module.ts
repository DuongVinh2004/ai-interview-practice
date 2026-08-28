import { Module } from '@nestjs/common';
import { MentorService } from './services/mentor.service';
import { BookingService } from './services/booking.service';
import { LiveSessionService } from './services/live-session.service';
import { CopilotHintService } from './services/copilot-hint.service';
import { MockMediaProvider } from './providers/mock-media.provider';
import { MentorController } from './controllers/mentor.controller';
import { BookingController } from './controllers/booking.controller';
import { LiveSessionController } from './controllers/live-session.controller';
import { MentorAdminController } from './controllers/mentor-admin.controller';
import { MentorAuthorityPolicy } from './policies/mentor-authority.policy';

@Module({
  controllers: [MentorController, BookingController, LiveSessionController, MentorAdminController],
  providers: [
    MentorService,
    BookingService,
    LiveSessionService,
    CopilotHintService,
    MentorAuthorityPolicy,
    {
      provide: 'MEDIA_PROVIDER',
      useClass: MockMediaProvider,
    },
  ],
  exports: [
    MentorService,
    BookingService,
    LiveSessionService,
    CopilotHintService,
    MentorAuthorityPolicy,
  ],
})
export class MentorModule {}
