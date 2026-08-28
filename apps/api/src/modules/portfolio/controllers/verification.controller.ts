import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators/public.decorator';
import { CertificateService } from '../services/certificate.service';

@ApiTags('Certificate Verification (F010)')
@Controller('public')
export class VerificationController {
  constructor(private readonly certificateService: CertificateService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('verify/:certId')
  @ApiOperation({ summary: 'Public verification portal for employer/recruiter certificate lookup' })
  async verify(@Param('certId') certId: string) {
    return this.certificateService.verifyCertificate(certId);
  }
}
