import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ShareService } from './share.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateShareTokenDto } from './dto/share.dto';
import { UserRole } from '@ai-interview/contracts';
import { Response } from 'express';

@ApiTags('Interview Sharing & Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interviews/:id')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post('share')
  @ApiOperation({ summary: 'Create a secure, time-limited share link for mentor review' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async createShareLink(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
    @Body() dto: CreateShareTokenDto,
  ) {
    return this.shareService.createShareToken(userId, sessionId, dto);
  }

  @Get('shares')
  @ApiOperation({ summary: 'List all share links and mentor feedbacks for an interview session' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async getShareLinks(@CurrentUser('sub') userId: string, @Param('id') sessionId: string) {
    return this.shareService.getSessionShareTokens(userId, sessionId);
  }

  @Delete('shares/:tokenId')
  @ApiOperation({ summary: 'Revoke an active share link' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  @ApiParam({ name: 'tokenId', description: 'Share token ID to revoke' })
  async revokeShareLink(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
    @Param('tokenId') tokenId: string,
  ) {
    return this.shareService.revokeShareToken(userId, sessionId, tokenId);
  }

  @Get('export/json')
  @ApiOperation({ summary: 'Export complete interview report as JSON archive' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async exportJson(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') sessionId: string,
    @Res() res: Response,
  ) {
    const data = await this.shareService.exportSessionJson(userId, userRole, sessionId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="interview-${sessionId}.json"`);
    return res.status(HttpStatus.OK).json(data);
  }
}
