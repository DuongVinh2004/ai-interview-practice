import { CompetencyArea, BadgeLevel, CertificateStatus } from '@ai-interview/contracts';

export class UpdatePortfolioSettingsDto {
  username?: string;
  isPublic?: boolean;
  displayName?: string;
  showRealName?: boolean;
  showBio?: boolean;
  showSkills?: boolean;
  showBadges?: boolean;
  showCertificates?: boolean;
  showHistory?: boolean;
  customBio?: string;
}

export class GenerateCertificateDto {
  competencyArea?: CompetencyArea;
  type?: string;
}

export class RevokeCertificateDto {
  reason?: string;
}
