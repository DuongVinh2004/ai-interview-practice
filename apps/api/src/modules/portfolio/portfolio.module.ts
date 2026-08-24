import { Module } from '@nestjs/common';
import { SignatureService } from './services/signature.service';
import { QrCodeService } from './services/qr-code.service';
import { BadgeService } from './services/badge.service';
import { CertificateService } from './services/certificate.service';
import { PortfolioService } from './services/portfolio.service';
import { PortfolioController } from './controllers/portfolio.controller';
import { PublicPortfolioController } from './controllers/public-portfolio.controller';
import { CertificateController } from './controllers/certificate.controller';
import { VerificationController } from './controllers/verification.controller';

@Module({
  controllers: [
    PortfolioController,
    PublicPortfolioController,
    CertificateController,
    VerificationController,
  ],
  providers: [
    SignatureService,
    QrCodeService,
    BadgeService,
    CertificateService,
    PortfolioService,
  ],
  exports: [
    SignatureService,
    QrCodeService,
    BadgeService,
    CertificateService,
    PortfolioService,
  ],
})
export class PortfolioModule {}
