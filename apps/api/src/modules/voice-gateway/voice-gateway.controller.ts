import { Controller, Post, Body, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { ErrorCode, UserRole } from '@ai-interview/contracts';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import * as crypto from 'crypto';

export class GenerateVoiceTicketDto {
  @IsString()
  @IsNotEmpty()
  interviewId!: string;
}

export class RecordVoiceConsentDto {
  @IsString()
  @IsNotEmpty()
  interviewId!: string;

  @IsString()
  @IsOptional()
  policyVersion?: string;
}

@ApiTags('Voice Gateway')
@Controller('voice-gateway')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VoiceGatewayController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Post('consent')
  @ApiOperation({
    summary: 'Record explicit user consent for voice streaming and processing (FINDING-001)',
  })
  async recordConsent(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: RecordVoiceConsentDto,
  ) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: dto.interviewId },
    });

    if (!session) {
      throw new DomainException(
        ErrorCode.SESSION_NOT_FOUND,
        'Interview session not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (session.userId !== userId && role !== UserRole.ADMIN) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have permission to consent for this interview session',
        HttpStatus.FORBIDDEN,
      );
    }

    const policyVersion = dto.policyVersion || 'VOICE-PRIVACY-2026.08';

    const consentRecord = await this.prisma.voiceConsentRecord.upsert({
      where: {
        userId_interviewId: {
          userId,
          interviewId: session.id,
        },
      },
      create: {
        userId,
        interviewId: session.id,
        policyVersion,
        consentedAt: new Date(),
      },
      update: {
        policyVersion,
        consentedAt: new Date(),
        revokedAt: null,
      },
    });

    return {
      consented: true,
      consentedAt: consentRecord.consentedAt,
      policyVersion: consentRecord.policyVersion,
      interviewId: session.id,
    };
  }

  @Post('ticket')
  @ApiOperation({
    summary: 'Generate a short-lived, single-use ticket for Voice WebSocket streaming',
  })
  async generateTicket(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: GenerateVoiceTicketDto,
  ) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: dto.interviewId },
    });

    if (!session) {
      throw new DomainException(
        ErrorCode.SESSION_NOT_FOUND,
        'Interview session not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (session.userId !== userId && role !== UserRole.ADMIN) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have permission to access this voice session',
        HttpStatus.FORBIDDEN,
      );
    }

    // 1. Enforce Explicit Voice Consent Check (FINDING-001)
    const consent = await this.prisma.voiceConsentRecord.findUnique({
      where: {
        userId_interviewId: {
          userId,
          interviewId: session.id,
        },
      },
    });

    if (!consent || consent.revokedAt) {
      throw new DomainException(
        ErrorCode.CONSENT_REQUIRED,
        'Explicit voice recording consent must be granted before acquiring a voice streaming ticket',
        HttpStatus.FORBIDDEN,
      );
    }

    const secret =
      this.configService.get<string>('jwt.accessSecret') ||
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'dev-access-secret-min-32-chars-ok';

    const ticketId = crypto.randomUUID();
    const ticket = this.jwtService.sign(
      {
        sub: userId,
        interviewId: session.id,
        role: session.userId === userId ? role : UserRole.ADMIN,
        tokenType: 'VOICE_TICKET',
        jti: ticketId,
      },
      {
        secret,
        expiresIn: '60s',
      },
    );

    return {
      ticket,
      expiresIn: 60,
      sessionId: session.id,
    };
  }
}
