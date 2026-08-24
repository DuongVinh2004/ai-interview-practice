import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ShareService } from './share.service';
import { AddMentorFeedbackDto } from './dto/share.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Public Mentor Review')
@Public()
@Controller('public/share')
export class PublicShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Publicly inspect shared interview report via secure token' })
  @ApiParam({ name: 'token', description: 'Unique crypto share token' })
  @ApiQuery({ name: 'passcode', required: false, description: 'Optional passcode if required' })
  async getPublicReport(
    @Param('token') token: string,
    @Query('passcode') passcode?: string,
  ) {
    return this.shareService.getPublicSharedResult(token, passcode);
  }

  @Post(':token/feedback')
  @ApiOperation({ summary: 'Submit mentor review comments or advice on a shared session' })
  @ApiParam({ name: 'token', description: 'Unique crypto share token' })
  async addMentorFeedback(
    @Param('token') token: string,
    @Body() dto: AddMentorFeedbackDto,
  ) {
    return this.shareService.addMentorFeedback(token, dto);
  }
}
