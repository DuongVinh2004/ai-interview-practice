import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ErrorCode } from '@ai-interview/contracts';

export const SANDBOX_LIMITS = {
  CPU_TIME_LIMIT_SECONDS: 5,
  WALL_TIME_LIMIT_SECONDS: 10,
  MEMORY_LIMIT_KB: 128_000, // 128MB
  STACK_LIMIT_KB: 64_000, // 64MB
  MAX_FILE_SIZE_KB: 50, // 50KB
  MAX_SOURCE_CODE_LENGTH: 50_000,
  MAX_STDIN_LENGTH: 50_000,
  MAX_TEST_CASES: 20,
} as const;

export const FORBIDDEN_COMPILER_FLAGS: Record<string, (string | RegExp)[]> = {
  universal: [
    /;\s*/,
    /\|\s*/,
    /&\s*/,
    /`/,
    /\$\(/,
    />/,
    /</,
    /\.\.\//,
    /\/etc\//,
    /\/proc\//,
    /\/sys\//,
    /\/dev\//,
    /\/root\//,
    /\/var\//,
  ],
  cpp: [
    '-fplugin',
    '-fplugin-arg',
    '-Wl,',
    '-Xlinker',
    '-include',
    '-specs=',
    '--script',
    '-T',
    '-shared',
    '-static-lib',
    '-fmacro-prefix-map',
    '-fdebug-prefix-map',
    /(?:^|\s)-o(?:\s|=|$)/, // -o output flag (case-sensitive, small o)
  ],
  c: [
    '-fplugin',
    '-fplugin-arg',
    '-Wl,',
    '-Xlinker',
    '-include',
    '-specs=',
    '--script',
    '-T',
    '-shared',
    /(?:^|\s)-o(?:\s|=|$)/,
  ],
  java: [
    '-agentpath:',
    '-agentlib:',
    '-javaagent:',
    '-D',
    '-cp',
    '-classpath',
    '--class-path',
    '--add-opens',
    '--add-modules',
    '--add-exports',
    '-Xbootclasspath',
    '-jar',
    '-XX:',
  ],
  go: [
    '-exec',
    '-tags',
    '-ldflags',
    '-gcflags',
    '-asmflags',
    '-gccgoflags',
    '-compiler',
    '-toolexec',
  ],
  python: ['-c', '-m', '-e', '--eval', '-W', '-X'],
  javascript: [
    '-e',
    '--eval',
    '-r',
    '--require',
    '--import',
    '--inspect',
    '--inspect-brk',
    '--loader',
    '--experimental-loader',
  ],
  typescript: [
    '-e',
    '--eval',
    '-r',
    '--require',
    '--import',
    '--inspect',
    '--inspect-brk',
    '--loader',
    '--experimental-loader',
    '--project',
    '-p',
  ],
};

export class SandboxSecurityValidator {
  /**
   * Validate compiler options for dangerous or disallowed flags
   */
  static validateCompilerOptions(language: string, compilerOptions?: string): void {
    if (!compilerOptions || !compilerOptions.trim()) {
      return;
    }

    const trimmed = compilerOptions.trim();
    const langKey = language.toLowerCase();

    // Check universal dangerous injection patterns
    for (const pattern of FORBIDDEN_COMPILER_FLAGS.universal) {
      if (typeof pattern === 'string' && trimmed.includes(pattern)) {
        throw new DomainException(
          ErrorCode.VALIDATION_ERROR,
          `Dangerous compiler option detected: '${pattern}' is strictly forbidden`,
          HttpStatus.BAD_REQUEST,
        );
      } else if (pattern instanceof RegExp && pattern.test(trimmed)) {
        throw new DomainException(
          ErrorCode.VALIDATION_ERROR,
          `Dangerous compiler option pattern detected matching '${pattern}'`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Token-based and regex-based language check
    const tokens = trimmed.split(/\s+/);
    const langSpecificRules = FORBIDDEN_COMPILER_FLAGS[langKey] || [];

    for (const rule of langSpecificRules) {
      if (rule instanceof RegExp) {
        if (rule.test(trimmed)) {
          throw new DomainException(
            ErrorCode.VALIDATION_ERROR,
            `Forbidden compiler flag matching pattern '${rule}' for language '${language}'`,
            HttpStatus.BAD_REQUEST,
          );
        }
      } else if (typeof rule === 'string') {
        const ruleLower = rule.toLowerCase();
        for (const token of tokens) {
          if (token.toLowerCase().startsWith(ruleLower)) {
            throw new DomainException(
              ErrorCode.VALIDATION_ERROR,
              `Forbidden compiler flag '${token}' matching '${rule}' for language '${language}'`,
              HttpStatus.BAD_REQUEST,
            );
          }
        }
      }
    }
  }

  /**
   * Validate stdin size
   */
  static validateStdin(stdin?: string): void {
    if (stdin && stdin.length > SANDBOX_LIMITS.MAX_STDIN_LENGTH) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        `Stdin input size (${stdin.length} characters) exceeds maximum allowed limit of ${SANDBOX_LIMITS.MAX_STDIN_LENGTH} characters`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Validate source code size
   */
  static validateSourceCode(sourceCode: string): void {
    if (!sourceCode || sourceCode.trim().length === 0) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Source code cannot be empty',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (sourceCode.length > SANDBOX_LIMITS.MAX_SOURCE_CODE_LENGTH) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        `Source code exceeds maximum allowed size (${SANDBOX_LIMITS.MAX_SOURCE_CODE_LENGTH} characters)`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
