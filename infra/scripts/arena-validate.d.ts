export interface ValidatorStageResult {
  stage: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  message: string;
  durationMs: number;
}

export interface ChallengeValidationResult {
  slug: string;
  title: string;
  domain?: string;
  difficulty?: number;
  overallPass: boolean;
  stages: ValidatorStageResult[];
  totalDurationMs?: number;
}

export function validateChallengeDir(dirPath: string): ChallengeValidationResult;
export function findChallengeDirs(baseDir: string): string[];
