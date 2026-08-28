import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MentorAuthorityState, UserRole } from '@ai-interview/contracts';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { MentorAuthorityTransitionDto } from '../dto/mentor.dto';
import { MentorService } from '../services/mentor.service';

@ApiTags('Admin Mentor Authority')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/mentors')
export class MentorAdminController {
  constructor(private readonly mentorService: MentorService) {}

  @Get()
  @ApiOperation({ summary: 'List mentor profiles by current authority state' })
  list(@Query('state') state?: MentorAuthorityState) {
    return this.mentorService.listAuthorityRequests(state);
  }

  @Patch(':id/authority')
  @ApiOperation({ summary: 'Apply an audited mentor authority transition' })
  transition(
    @Param('id') mentorProfileId: string,
    @CurrentUser('sub') adminUserId: string,
    @Body() dto: MentorAuthorityTransitionDto,
  ) {
    return this.mentorService.transitionAuthority(
      mentorProfileId,
      adminUserId,
      dto.state,
      dto.reason,
    );
  }
}
