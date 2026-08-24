import { TenantRole, AssignmentStatus, SessionMode } from '@ai-interview/contracts';

export class CreateTenantDto {
  name!: string;
  slug!: string;
  domain?: string;
  brandingConfig?: {
    logoUrl?: string;
    primaryColor: string;
    accentColor: string;
    companyName?: string;
  };
}

export class UpdateBrandingDto {
  brandingConfig!: {
    logoUrl?: string;
    primaryColor: string;
    accentColor: string;
    companyName?: string;
  };
}

export class CreateCohortDto {
  name!: string;
  description?: string;
}

export class ImportRosterDto {
  csvContent!: string;
}

export class CreateAssignmentDto {
  cohortId!: string;
  title!: string;
  description?: string;
  deadline?: string;
  config?: {
    sessionMode?: SessionMode;
    difficulty?: number;
    targetScore?: number;
    rubricId?: string;
    questionBankId?: string;
  };
}

export class PublishAssignmentDto {
  status!: AssignmentStatus;
}

export class CreateApiKeyDto {
  name!: string;
}
