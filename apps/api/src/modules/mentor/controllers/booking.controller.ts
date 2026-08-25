import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { BookingService } from '../services/booking.service';
import { BookSessionDto } from '../dto/mentor.dto';

@ApiTags('Mentor Session Booking (F012)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post('book')
  @ApiOperation({ summary: 'Book collision-safe 1-on-1 interview session with a mentor' })
  async bookSession(@CurrentUser('sub') candidateId: string, @Body() dto: BookSessionDto) {
    return this.bookingService.bookSession(candidateId, dto.mentorId, dto.scheduledAt);
  }

  @Get('my')
  @ApiOperation({ summary: 'List all upcoming and past live mentoring sessions for current user' })
  async getMySessions(@CurrentUser('sub') userId: string) {
    return this.bookingService.getMySessions(userId);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booked live session' })
  async cancelSession(@Param('id') sessionId: string, @CurrentUser('sub') userId: string) {
    return this.bookingService.cancelSession(sessionId, userId);
  }
}
