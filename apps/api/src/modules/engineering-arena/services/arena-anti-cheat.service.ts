import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  ArenaAntiCheatReport,
  ArenaAntiCheatFlag,
  PlagiarismReport,
  CodeSimilarityMatch,
  ArenaAnalyzeAntiCheatRequest,
} from '@ai-interview/contracts';

export type AntiCheatReport = ArenaAntiCheatReport;

export interface WinnowingFingerprint {
  hash: number;
  position: number;
}

export interface WinnowingOptions {
  kGramSize?: number;
  windowSize?: number;
}

export interface CodeComparisonOptions extends WinnowingOptions {
  sourceFile?: string;
  targetFile?: string;
  targetSessionId?: string;
}

export interface VelocityAnomalyRecord {
  sequence: number;
  tokens: number;
  durationMs: number;
}

const RESERVED_KEYWORDS = new Set([
  'function',
  'def',
  'class',
  'const',
  'let',
  'var',
  'return',
  'if',
  'else',
  'elif',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'default',
  'try',
  'catch',
  'finally',
  'throw',
  'new',
  'this',
  'typeof',
  'instanceof',
  'import',
  'export',
  'from',
  'as',
  'async',
  'await',
  'yield',
  'null',
  'undefined',
  'true',
  'false',
  'None',
  'True',
  'False',
  'in',
  'of',
  'extends',
  'implements',
  'interface',
  'type',
  'public',
  'private',
  'protected',
  'static',
  'readonly',
]);

const MULTI_CHAR_OPERATORS = [
  '===',
  '!==',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '??',
  '=>',
  '+=',
  '-=',
  '*=',
  '/=',
  '++',
  '--',
  '**',
  '...',
  '?.',
];

@Injectable()
export class ArenaAntiCheatService {
  private readonly logger = new Logger(ArenaAntiCheatService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * AST Lexical Tokenizer & Canonicalization.
   * Strips whitespace & comments, normalizes variable/function identifiers to 'ID',
   * numbers to 'NUM', strings to 'STR', while preserving language control flow keywords and operators.
   */
  tokenizeCode(code: string): string[] {
    const tokens: string[] = [];
    if (!code) return tokens;

    let i = 0;
    const len = code.length;

    while (i < len) {
      const ch = code[i];

      // 1. Skip whitespace
      if (ch <= ' ') {
        i++;
        continue;
      }

      // 2. Skip single-line comments: // or #
      if (code.startsWith('//', i)) {
        i += 2;
        while (i < len && code[i] !== '\n') i++;
        continue;
      }
      if (ch === '#') {
        i++;
        while (i < len && code[i] !== '\n') i++;
        continue;
      }

      // 3. Skip multi-line comments: /* ... */ or """ ... """ or ''' ... '''
      if (code.startsWith('/*', i)) {
        i += 2;
        const endIdx = code.indexOf('*/', i);
        i = endIdx === -1 ? len : endIdx + 2;
        continue;
      }
      if (code.startsWith('"""', i)) {
        i += 3;
        const endIdx = code.indexOf('"""', i);
        i = endIdx === -1 ? len : endIdx + 3;
        continue;
      }
      if (code.startsWith("'''", i)) {
        i += 3;
        const endIdx = code.indexOf("'''", i);
        i = endIdx === -1 ? len : endIdx + 3;
        continue;
      }

      // 4. String literals: "...", '...', `...` -> STR
      if (ch === '"' || ch === "'" || ch === '`') {
        const quote = ch;
        i++;
        while (i < len) {
          if (code[i] === '\\') {
            i += 2;
          } else if (code[i] === quote) {
            i++;
            break;
          } else {
            i++;
          }
        }
        tokens.push('STR');
        continue;
      }

      // 5. Numeric literals -> NUM
      if (
        (ch >= '0' && ch <= '9') ||
        (ch === '.' && i + 1 < len && code[i + 1] >= '0' && code[i + 1] <= '9')
      ) {
        let isHex = false;
        if (ch === '0' && i + 1 < len && (code[i + 1] === 'x' || code[i + 1] === 'X')) {
          isHex = true;
          i += 2;
        }
        while (i < len) {
          const c = code[i];
          if (isHex ? /[0-9a-fA-F]/.test(c) : /[0-9.eE+-]/.test(c)) {
            i++;
          } else {
            break;
          }
        }
        tokens.push('NUM');
        continue;
      }

      // 6. Identifiers and Keywords
      if (/[a-zA-Z_$]/.test(ch)) {
        const start = i;
        while (i < len && /[a-zA-Z0-9_$]/.test(code[i])) {
          i++;
        }
        const ident = code.substring(start, i);
        if (RESERVED_KEYWORDS.has(ident)) {
          tokens.push(ident);
        } else {
          tokens.push('ID');
        }
        continue;
      }

      // 7. Multi-character operators
      let matchedMulti = false;
      for (const op of MULTI_CHAR_OPERATORS) {
        if (code.startsWith(op, i)) {
          tokens.push(op);
          i += op.length;
          matchedMulti = true;
          break;
        }
      }
      if (matchedMulti) continue;

      // 8. Single character punctuation / operators
      tokens.push(ch);
      i++;
    }

    return tokens;
  }

  /**
   * Winnowing Fingerprinting Algorithm (Moss standard).
   * Generates k-gram rolling hashes and selects minimum hash in each sliding window (rightmost tie-breaking).
   */
  computeWinnowingFingerprints(code: string, options?: WinnowingOptions): WinnowingFingerprint[] {
    const tokens = this.tokenizeCode(code);
    if (tokens.length === 0) return [];

    const k = Math.max(2, Math.min(options?.kGramSize ?? 5, tokens.length));
    const w = Math.max(1, options?.windowSize ?? 4);

    // Compute k-gram rolling hashes
    const hashes: WinnowingFingerprint[] = [];
    const numGrams = tokens.length - k + 1;

    for (let i = 0; i < numGrams; i++) {
      let h = 0;
      for (let j = 0; j < k; j++) {
        const tok = tokens[i + j];
        let tokHash = 0;
        for (let c = 0; c < tok.length; c++) {
          tokHash = (Math.imul(31, tokHash) + tok.charCodeAt(c)) | 0;
        }
        h = (Math.imul(31, h) + tokHash) | 0;
      }
      hashes.push({ hash: Math.abs(h), position: i });
    }

    if (hashes.length === 0) {
      return [];
    }

    // Winnowing window minimum selection
    if (hashes.length <= w) {
      let min = hashes[0];
      for (let i = 1; i < hashes.length; i++) {
        // Rightmost minimum rule upon tie
        if (hashes[i].hash <= min.hash) {
          min = hashes[i];
        }
      }
      return [min];
    }

    const fingerprints: WinnowingFingerprint[] = [];
    let lastRecordedPos = -1;

    for (let i = 0; i <= hashes.length - w; i++) {
      let min = hashes[i];
      for (let j = 1; j < w; j++) {
        const cand = hashes[i + j];
        // Rightmost minimum rule upon tie
        if (cand.hash <= min.hash) {
          min = cand;
        }
      }
      if (min.position !== lastRecordedPos) {
        fingerprints.push(min);
        lastRecordedPos = min.position;
      }
    }

    return fingerprints;
  }

  /**
   * Compares two code snippets using the Winnowing algorithm.
   * Returns similarity score (0.0 to 1.0) and matched fingerprints count.
   */
  compareCodeSnippets(
    codeA: string,
    codeB: string,
    options?: CodeComparisonOptions,
  ): CodeSimilarityMatch {
    const fpA = this.computeWinnowingFingerprints(codeA, options);
    const fpB = this.computeWinnowingFingerprints(codeB, options);

    const sourceFile = options?.sourceFile || 'source.ts';
    const targetFile = options?.targetFile || 'target.ts';

    if (fpA.length === 0 && fpB.length === 0) {
      const tokA = this.tokenizeCode(codeA);
      const tokB = this.tokenizeCode(codeB);
      const isIdentical = tokA.length > 0 && tokA.join('') === tokB.join('');
      return {
        targetSessionId: options?.targetSessionId,
        sourceFile,
        targetFile,
        similarityScore: isIdentical ? 1.0 : 0.0,
        matchedFingerprints: isIdentical ? 1 : 0,
        totalFingerprints: isIdentical ? 1 : 0,
        evidence: isIdentical ? 'Identical short token stream.' : undefined,
      };
    }

    const setA = new Set(fpA.map(f => f.hash));
    const setB = new Set(fpB.map(f => f.hash));

    let matchedCount = 0;
    for (const h of setA) {
      if (setB.has(h)) {
        matchedCount++;
      }
    }

    const totalDistinct = new Set([...setA, ...setB]).size;
    const totalFingerprints = Math.max(setA.size, setB.size);

    // Dice similarity: 2 * |A ∩ B| / (|A| + |B|)
    const dice = setA.size + setB.size > 0 ? (2 * matchedCount) / (setA.size + setB.size) : 0;
    // Containment similarity: |A ∩ B| / min(|A|, |B|)
    const containment =
      Math.min(setA.size, setB.size) > 0 ? matchedCount / Math.min(setA.size, setB.size) : 0;

    // Harmonize score: if containment is very high (shuffled blocks/subset), factor it in
    const rawScore = Math.max(dice, containment * 0.92);
    const similarityScore = Number(Math.min(1.0, Math.max(0.0, rawScore)).toFixed(4));

    return {
      targetSessionId: options?.targetSessionId,
      sourceFile,
      targetFile,
      similarityScore,
      matchedFingerprints: matchedCount,
      totalFingerprints,
      evidence:
        similarityScore >= 0.8
          ? `High lexical structure overlap: ${matchedCount}/${totalFingerprints} fingerprints matched.`
          : undefined,
    };
  }

  /**
   * Keystroke velocity anomaly check: detects code pasting > 50 tokens in < 1000ms.
   */
  checkKeystrokeVelocityAnomaly(input: {
    metadata?: Record<string, unknown>;
    durationMs?: number;
  }): boolean {
    const metadata = input.metadata || {};
    const durationMs =
      input.durationMs ??
      (typeof metadata.durationMs === 'number' ? metadata.durationMs : undefined);

    const tokens =
      typeof metadata.insertedTokens === 'number'
        ? metadata.insertedTokens
        : typeof metadata.pastedTokens === 'number'
          ? metadata.pastedTokens
          : typeof metadata.tokenCount === 'number'
            ? metadata.tokenCount
            : typeof metadata.pastedCharCount === 'number'
              ? Math.round(metadata.pastedCharCount / 5)
              : 0;

    if (durationMs !== undefined && durationMs < 1000 && tokens > 50) {
      return true;
    }

    if (
      typeof metadata.pastedCharCount === 'number' &&
      metadata.pastedCharCount > 500 &&
      (durationMs === undefined || durationMs < 1000)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Analyzes an array of chronological action events for keystroke velocity anomalies.
   */
  analyzeActionEventsVelocity(
    events: Array<{
      sequence: number;
      occurredAt: string | Date;
      metadata?: Record<string, unknown>;
    }>,
  ): VelocityAnomalyRecord[] {
    const anomalies: VelocityAnomalyRecord[] = [];
    if (!events || events.length === 0) return anomalies;

    for (let i = 0; i < events.length; i++) {
      const evt = events[i];
      const metadata = evt.metadata || {};

      let durationMs: number | undefined =
        typeof metadata.durationMs === 'number' ? metadata.durationMs : undefined;

      if (durationMs === undefined && i > 0) {
        const prevTime = new Date(events[i - 1].occurredAt).getTime();
        const currTime = new Date(evt.occurredAt).getTime();
        const delta = currTime - prevTime;
        if (delta >= 0) {
          durationMs = delta;
        }
      }

      const tokens =
        typeof metadata.insertedTokens === 'number'
          ? metadata.insertedTokens
          : typeof metadata.pastedTokens === 'number'
            ? metadata.pastedTokens
            : typeof metadata.tokenCount === 'number'
              ? metadata.tokenCount
              : typeof metadata.pastedCharCount === 'number'
                ? Math.round(metadata.pastedCharCount / 5)
                : 0;

      if (durationMs !== undefined && durationMs < 1000 && tokens > 50) {
        anomalies.push({
          sequence: evt.sequence,
          tokens,
          durationMs,
        });
      }
    }

    return anomalies;
  }

  /**
   * Performs end-to-end anti-cheat analysis for an Arena session:
   * - Unnatural completion speed
   * - Keystroke velocity anomaly & burst pasting (> 50 tokens in < 1000ms)
   * - Zero intermediate test runs
   * - AST Winnowing code plagiarism against reference/peer solutions
   * - Forensic Risk Score calculation (0-100)
   */
  async analyzeSession(
    sessionId: string,
    options?: ArenaAnalyzeAntiCheatRequest,
  ): Promise<ArenaAntiCheatReport> {
    const session = await this.prisma.arenaSession.findUnique({
      where: { id: sessionId },
      include: {
        actionEvents: { orderBy: { sequence: 'asc' } },
        executionRuns: { orderBy: { createdAt: 'asc' } },
        challengeVersion: {
          include: { challenge: true },
        },
        submissions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!session) {
      return {
        sessionId,
        isSuspicious: false,
        riskScore: 0,
        flags: [],
        analyzedAt: new Date().toISOString(),
      };
    }

    const flags: ArenaAntiCheatFlag[] = [];
    let riskScore = 0;

    const actionEvents = session.actionEvents || [];
    const executionRuns = session.executionRuns || [];
    const challenge = session.challengeVersion.challenge;

    // 1. Check for Unnatural Completion Speed
    if (session.startedAt && session.submittedAt) {
      const durationSeconds =
        (new Date(session.submittedAt).getTime() - new Date(session.startedAt).getTime()) / 1000;
      if (challenge.difficulty >= 3 && durationSeconds < 180 && executionRuns.length === 0) {
        flags.push({
          ruleId: 'UNNATURAL_COMPLETION_SPEED',
          description: `Difficulty ${challenge.difficulty} challenge completed in ${Math.round(durationSeconds)}s without running tests.`,
          severity: 'HIGH',
          metadata: {
            durationSeconds,
            difficulty: challenge.difficulty,
            testRunsCount: executionRuns.length,
          },
        });
        riskScore += 50;
      }
    }

    // 2. Keystroke Velocity Anomaly & Burst Paste Check
    const velocityAnomalies = this.analyzeActionEventsVelocity(
      actionEvents as Array<{
        sequence: number;
        occurredAt: string | Date;
        metadata?: Record<string, unknown>;
      }>,
    );

    if (velocityAnomalies.length > 0) {
      const topAnomaly = velocityAnomalies[0];
      flags.push({
        ruleId: 'KEYSTROKE_VELOCITY_ANOMALY',
        description: `Velocity anomaly detected: inserted ${topAnomaly.tokens} tokens in ${topAnomaly.durationMs}ms (> 50 tokens in < 1000ms).`,
        severity: 'HIGH',
        metadata: {
          sequence: topAnomaly.sequence,
          tokens: topAnomaly.tokens,
          durationMs: topAnomaly.durationMs,
          totalAnomalies: velocityAnomalies.length,
        },
      });
      riskScore += 35;
    }

    // Legacy Burst Paste check
    for (const evt of actionEvents) {
      const metadata = (evt.metadata as Record<string, unknown>) || {};
      if (metadata.pastedCharCount && (metadata.pastedCharCount as number) > 500) {
        flags.push({
          ruleId: 'BURST_PASTE_DETECTED',
          description: `Large burst paste event detected (${metadata.pastedCharCount} characters inserted at once).`,
          severity: 'MEDIUM',
          metadata: { pastedCharCount: metadata.pastedCharCount, sequence: evt.sequence },
        });
        riskScore += 30;
        break;
      }
    }

    // 3. Check for Zero Test Run Submission on Complex Challenges
    if (challenge.difficulty >= 4 && executionRuns.length === 0) {
      flags.push({
        ruleId: 'ZERO_INTERMEDIATE_TEST_RUNS',
        description:
          'Candidate submitted high-difficulty solution without executing test suite once.',
        severity: 'LOW',
        metadata: { difficulty: challenge.difficulty },
      });
      riskScore += 15;
    }

    // 4. Code Plagiarism Detection via Winnowing Algorithm
    const candidateFiles = options?.candidateFiles || [];
    const comparisonSnippets = options?.comparisonSnippets || [];
    const matches: CodeSimilarityMatch[] = [];
    let highestSimilarityScore = 0;

    if (candidateFiles.length > 0 && comparisonSnippets.length > 0) {
      for (const cand of candidateFiles) {
        for (const snippet of comparisonSnippets) {
          const match = this.compareCodeSnippets(cand.content, snippet.content, {
            sourceFile: cand.path,
            targetFile: snippet.file,
            targetSessionId: snippet.sourceId,
            kGramSize: options?.kGramSize ?? 5,
            windowSize: options?.windowSize ?? 4,
          });

          if (match.similarityScore > 0.3) {
            matches.push(match);
          }
          if (match.similarityScore > highestSimilarityScore) {
            highestSimilarityScore = match.similarityScore;
          }
        }
      }

      if (highestSimilarityScore >= 0.85) {
        flags.push({
          ruleId: 'CODE_PLAGIARISM_DETECTED',
          description: `High probability code plagiarism detected (${(highestSimilarityScore * 100).toFixed(1)}% similarity).`,
          severity: 'HIGH',
          metadata: {
            highestSimilarityScore,
            matchesCount: matches.length,
          },
        });
        riskScore += 50;
      } else if (highestSimilarityScore >= 0.6) {
        flags.push({
          ruleId: 'SUSPICIOUS_CODE_SIMILARITY',
          description: `Suspicious code similarity detected (${(highestSimilarityScore * 100).toFixed(1)}% similarity).`,
          severity: 'MEDIUM',
          metadata: {
            highestSimilarityScore,
            matchesCount: matches.length,
          },
        });
        riskScore += 25;
      }
    }

    const normalizedRiskScore = Math.min(100, Math.max(0, riskScore));
    const isSuspicious = normalizedRiskScore >= 60;

    if (isSuspicious) {
      this.logger.warn(
        `Session ${sessionId} flagged as suspicious with risk score ${normalizedRiskScore} (${flags.length} flags triggered)`,
      );
    }

    const plagiarismReport: PlagiarismReport = {
      sessionId,
      isPlagiarized: highestSimilarityScore >= 0.85,
      highestSimilarityScore: Number(highestSimilarityScore.toFixed(4)),
      forensicRiskScore: normalizedRiskScore,
      matches,
      analyzedAt: new Date().toISOString(),
    };

    return {
      sessionId,
      isSuspicious,
      riskScore: normalizedRiskScore,
      flags,
      plagiarismReport,
      analyzedAt: new Date().toISOString(),
    };
  }
}
