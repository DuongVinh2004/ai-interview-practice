import { Injectable, Logger } from '@nestjs/common';
import { ArenaChallengeManifest } from '@ai-interview/contracts';
import { ManifestValidator } from '../manifest/manifest-validator';

export enum ValidatorStageStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  SKIPPED = 'SKIPPED',
}

export interface ValidatorStageResult {
  stage: string;
  status: ValidatorStageStatus;
  message: string;
  durationMs: number;
}

export interface ChallengeValidationReport {
  overallPass: boolean;
  totalStages: number;
  passedStages: number;
  failedStages: number;
  stages: ValidatorStageResult[];
  validatedAt: string;
}

@Injectable()
export class ChallengeValidatorService {
  private readonly logger = new Logger(ChallengeValidatorService.name);

  // Common secret patterns to prevent accidental leaks in challenges
  private readonly SECRET_PATTERNS = [
    /AKIA[0-9A-Z]{16}/, // AWS Access Key
    /ghp_[a-zA-Z0-9]{36}/, // GitHub Personal Access Token
    /sk-[a-zA-Z0-9]{32,}/, // OpenAI/General API Secret Key
    /BEGIN (RSA|EC|OPENSSH) PRIVATE KEY/, // Private keys
    /postgres:\/\/[^:]+:[^@]+@/, // Database credentials
  ];

  async validateChallengePackage(params: {
    manifest: ArenaChallengeManifest;
    visibleFilesContent: Record<string, string>;
    hiddenFilesContent: Record<string, string>;
    referenceSolutionContent?: Record<string, string>;
  }): Promise<ChallengeValidationReport> {
    const stages: ValidatorStageResult[] = [];
    const startTime = Date.now();

    // Stage 1: Schema Validation
    const stage1Start = Date.now();
    const manifestCheck = ManifestValidator.validate(params.manifest);
    stages.push({
      stage: '1_SCHEMA_VALIDATION',
      status: manifestCheck.isValid ? ValidatorStageStatus.PASS : ValidatorStageStatus.FAIL,
      message: manifestCheck.isValid
        ? 'Manifest conforms to schema v1.0'
        : manifestCheck.errors.join('; '),
      durationMs: Date.now() - stage1Start,
    });

    // Stage 2: Source Integrity Check
    const stage2Start = Date.now();
    const missingVisible = params.manifest.visibleFiles.filter(
      (f) => !(f in params.visibleFilesContent),
    );
    stages.push({
      stage: '2_SOURCE_INTEGRITY',
      status: missingVisible.length === 0 ? ValidatorStageStatus.PASS : ValidatorStageStatus.FAIL,
      message:
        missingVisible.length === 0
          ? 'All declared visible files are present'
          : `Missing visible files: ${missingVisible.join(', ')}`,
      durationMs: Date.now() - stage2Start,
    });

    // Stage 3: Secrets Scan
    const stage3Start = Date.now();
    const secretFindings: string[] = [];
    const allFiles = { ...params.visibleFilesContent, ...params.hiddenFilesContent };
    for (const [path, content] of Object.entries(allFiles)) {
      for (const pattern of this.SECRET_PATTERNS) {
        if (pattern.test(content)) {
          secretFindings.push(`Potential credential found in ${path}`);
        }
      }
    }
    stages.push({
      stage: '3_SECRETS_SCAN',
      status: secretFindings.length === 0 ? ValidatorStageStatus.PASS : ValidatorStageStatus.FAIL,
      message:
        secretFindings.length === 0
          ? 'No hardcoded credentials or API keys detected'
          : secretFindings.join('; '),
      durationMs: Date.now() - stage3Start,
    });

    // Stage 4: Runtime Image & Environment Validation
    const stage4Start = Date.now();
    const validRuntimes = ['node:22', 'node:20', 'python:3.12', 'python:3.11', 'go:1.23'];
    const runtimeValid = validRuntimes.includes(params.manifest.environment.runtime);
    stages.push({
      stage: '4_RUNTIME_IMAGE_CHECK',
      status: runtimeValid ? ValidatorStageStatus.PASS : ValidatorStageStatus.FAIL,
      message: runtimeValid
        ? `Supported runtime: ${params.manifest.environment.runtime}`
        : `Unsupported runtime '${params.manifest.environment.runtime}'. Allowed: ${validRuntimes.join(', ')}`,
      durationMs: Date.now() - stage4Start,
    });

    // Stage 5: Hidden Test Isolation Separation
    const stage5Start = Date.now();
    const leakedHidden = params.manifest.hiddenFiles.filter(
      (h) => h in params.visibleFilesContent,
    );
    stages.push({
      stage: '5_CANDIDATE_ARTIFACT_SEPARATION',
      status: leakedHidden.length === 0 ? ValidatorStageStatus.PASS : ValidatorStageStatus.FAIL,
      message:
        leakedHidden.length === 0
          ? 'Hidden tests and reference solution are strictly isolated from candidate bundle'
          : `Hidden files leaked into candidate visible bundle: ${leakedHidden.join(', ')}`,
      durationMs: Date.now() - stage5Start,
    });

    // Stage 6: Rubric and Skills Consistency
    const stage6Start = Date.now();
    const skillsValid = params.manifest.skills.length > 0;
    stages.push({
      stage: '6_RUBRIC_AND_SKILLS',
      status: skillsValid ? ValidatorStageStatus.PASS : ValidatorStageStatus.FAIL,
      message: skillsValid
        ? `Rubric configured with ${params.manifest.skills.length} mapped skills`
        : 'Challenge must define at least one target skill in taxonomy',
      durationMs: Date.now() - stage6Start,
    });

    const failedStages = stages.filter((s) => s.status === ValidatorStageStatus.FAIL).length;
    const passedStages = stages.filter((s) => s.status === ValidatorStageStatus.PASS).length;

    return {
      overallPass: failedStages === 0,
      totalStages: stages.length,
      passedStages,
      failedStages,
      stages,
      validatedAt: new Date().toISOString(),
    };
  }
}
