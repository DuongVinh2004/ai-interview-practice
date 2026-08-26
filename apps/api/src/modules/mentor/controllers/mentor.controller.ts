import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { MentorService } from '../services/mentor.service';
import { CreateMentorProfileDto, SetAvailabilityDto } from '../dto/mentor.dto';

@ApiTags('Mentors & Directory (F012)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mentor')
export class MentorController {
  constructor(private readonly mentorService: MentorService) {}

  @Get('profile/me')
  @ApiOperation({ summary: 'Get current user mentor profile or initialize if eligible' })
  async getMyProfile(@CurrentUser('sub') userId: string) {
    return this.mentorService.getOrCreateMentorProfile(userId);
  }

  @Post('profile')
  @ApiOperation({ summary: 'Create or update mentor profile, bio, and expertise areas' })
  async updateProfile(@CurrentUser('sub') userId: string, @Body() dto: CreateMentorProfileDto) {
    return this.mentorService.createOrUpdateProfile(userId, dto);
  }

  @Post('availability')
  @ApiOperation({ summary: 'Set recurring weekly availability slots for mentorship' })
  async setAvailability(@CurrentUser('sub') userId: string, @Body() dto: SetAvailabilityDto) {
    return this.mentorService.setAvailability(userId, dto);
  }

  @Get('availability/:mentorId')
  @ApiOperation({ summary: 'Get available time slots for a specific mentor' })
  async getMentorAvailability(@Param('mentorId') mentorId: string) {
    return this.mentorService.getMentorAvailability(mentorId);
  }

  @Get('list')
  @ApiOperation({ summary: 'List active verified mentors with rating and expertise filter' })
  async listMentors(@Query('expertise') expertise?: string) {
    return this.mentorService.listMentors(expertise);
  }
}
