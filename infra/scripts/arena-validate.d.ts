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

export declare const SECRET_PATTERNS: RegExp[];
export declare const NETWORK_PATTERNS: RegExp[];
export declare const VALID_RUNTIMES: string[];

export function validateChallengeDir(dirPath: string): Promise<ChallengeValidationResult>;
export function findChallengeDirs(baseDir: string): string[];
export function seedChallengePack(dirPath: string): Promise<boolean>;
export function parseArgs(): { targetDir: string | null; seed: boolean; json: boolean };
