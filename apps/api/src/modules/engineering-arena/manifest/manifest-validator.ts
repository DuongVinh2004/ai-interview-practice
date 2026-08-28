import { ArenaChallengeManifest, ArenaChallengeManifestSchema } from '@ai-interview/contracts';

export interface ManifestValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ManifestValidator {
  private static readonly MAX_MEMORY_LIMIT_MB = 2048;
  private static readonly MAX_CPU_LIMIT = 4.0;
  private static readonly MAX_TIMEOUT_SECONDS = 120;

  /**
   * Validates manifest structure, security constraints, unique command IDs, and weights.
   */
  static validate(manifest: unknown): ManifestValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Zod schema parse
    const parseResult = ArenaChallengeManifestSchema.safeParse(manifest);
    if (!parseResult.success) {
      for (const issue of parseResult.error.issues) {
        errors.push(`[${issue.path.join('.')}] ${issue.message}`);
      }
      return { isValid: false, errors, warnings };
    }

    const data = parseResult.data;

    // 2. Command IDs uniqueness
    const commandIds = new Set<string>();
    for (const cmd of data.commands) {
      if (commandIds.has(cmd.id)) {
        errors.push(`Duplicate command ID '${cmd.id}' found.`);
      }
      commandIds.add(cmd.id);

      if (cmd.timeoutSeconds > this.MAX_TIMEOUT_SECONDS) {
        errors.push(
          `Command '${cmd.id}' timeout (${cmd.timeoutSeconds}s) exceeds maximum allowed (${this.MAX_TIMEOUT_SECONDS}s).`,
        );
      }
    }

    // Must have at least one test command
    if (!data.commands.some(c => c.id === 'test' || c.isVerification)) {
      warnings.push(`Manifest does not define an explicit 'test' or verification command.`);
    }

    // 3. Security Limits
    if (data.environment.memoryLimitMb > this.MAX_MEMORY_LIMIT_MB) {
      errors.push(
        `Memory limit (${data.environment.memoryLimitMb}MB) exceeds platform maximum (${this.MAX_MEMORY_LIMIT_MB}MB).`,
      );
    }
    if (data.environment.cpuLimit > this.MAX_CPU_LIMIT) {
      errors.push(
        `CPU limit (${data.environment.cpuLimit}) exceeds platform maximum (${this.MAX_CPU_LIMIT}).`,
      );
    }

    // 4. Rubric Weights validation
    const totalRubricWeight = data.rubric.objectiveWeight + data.rubric.rubricWeight;
    if (Math.abs(totalRubricWeight - 1.0) > 0.001) {
      errors.push(
        `Objective weight (${data.rubric.objectiveWeight}) + Rubric weight (${data.rubric.rubricWeight}) must sum to 1.0.`,
      );
    }

    // 5. File separation validation
    const editableSet = new Set(data.editableFiles);
    for (const hiddenFile of data.hiddenFiles) {
      if (editableSet.has(hiddenFile)) {
        errors.push(`Security violation: Hidden file '${hiddenFile}' is also marked as editable.`);
      }
      if (data.visibleFiles.includes(hiddenFile)) {
        errors.push(`Security violation: Hidden file '${hiddenFile}' is also marked as visible.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
