import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { CertificateService } from '../services/certificate.service';

@ApiTags('Certificate Verification (F010)')
@Controller('public')
export class VerificationController {
  constructor(private readonly certificateService: CertificateService) {}

  @Public()
  @Get('verify/:certId')
  @ApiOperation({ summary: 'Public verification portal for employer/recruiter certificate lookup' })
  async verify(@Param('certId') certId: string) {
    return this.certificateService.verifyCertificate(certId);
  }
}
