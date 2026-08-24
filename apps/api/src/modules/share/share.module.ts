import { Module } from '@nestjs/common';
import { ShareService } from './share.service';
import { ShareController } from './share.controller';
import { PublicShareController } from './public-share.controller';

@Module({
  controllers: [ShareController, PublicShareController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
