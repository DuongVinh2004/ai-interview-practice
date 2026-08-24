import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CertificateService } from '../services/certificate.service';
import { GenerateCertificateDto, RevokeCertificateDto } from '../dto/portfolio.dto';

@ApiTags('Certificates (F010)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('certificates')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate digital verified certificate for candidate (Gold/Platinum required)' })
  async generate(
    @CurrentUser('sub') userId: string,
    @Body() dto: GenerateCertificateDto,
  ) {
    return this.certificateService.generateCertificate(userId, dto.competencyArea, dto.type || 'COMPETENCY');
  }

  @Get('my')
  @ApiOperation({ summary: 'List current user certificates' })
  async getMyCertificates(@CurrentUser('sub') userId: string) {
    return this.certificateService.getUserCertificates(userId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download certificate document and metadata' })
  async download(
    @Param('id') certId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.certificateService.downloadCertificate(certId, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an issued certificate' })
  async revoke(
    @Param('id') certId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: RevokeCertificateDto,
  ) {
    return this.certificateService.revokeCertificate(certId, userId, dto?.reason);
  }
}
