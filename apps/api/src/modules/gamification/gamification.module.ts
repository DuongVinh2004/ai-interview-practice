import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { XpService } from './xp.service';
import { BadgeService } from './badge.service';
import { StreakService } from './streak.service';
import { GamificationEventListener } from './gamification.listener';
import { GamificationController } from './gamification.controller';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [GamificationController],
  providers: [XpService, BadgeService, StreakService, GamificationEventListener],
  exports: [XpService, BadgeService, StreakService],
})
export class GamificationModule {}
