import { Injectable, Logger } from '@nestjs/common';
import { EvaluationPromptContext } from '../interfaces/ai-provider.interface';
import { EvaluatedAnswerAi } from '@ai-interview/contracts';

export interface PreFilterResult {
  isSafe: boolean;
  safetyFlags: string[];
  directEvaluation?: EvaluatedAnswerAi;
}

@Injectable()
export class AiSecurityFilterService {
  private readonly logger = new Logger(AiSecurityFilterService.name);

  /**
   * Pre-execution safety filter for candidate answers.
   * Intercepts prompt injections, protected trait inferences, and spam.
   */
  preFilter(context: EvaluationPromptContext): PreFilterResult {
    const rawAnswer = context.answer.trim();
    const lowerAnswer = rawAnswer.toLowerCase();

    // 1. Prompt Injection & System Override Check
    const injectionPatterns = [
      /ignore\s+(all|every|previous|prior|earlier)\s+instruction/i,
      /reveal\s+(the\s+)?(hidden\s+)?(rubric|system\s+prompt|prompt|instructions)/i,
      /give\s+me\s+(100|10(\.0)?|a\s+perfect\s+score)/i,
      /print\s+(the\s+)?(api\s+key|environment)/i,
      /exfiltrate/i,
      /system\s*:\s*you\s+are/i,
      /<\/?system>/i,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(lowerAnswer)) {
        this.logger.warn(`Prompt injection pattern detected in answer: ${pattern.source}`);
        return {
          isSafe: false,
          safetyFlags: ['prompt_injection'],
          directEvaluation: {
            score: 0.0,
            rubricScores: { technicalAccuracy: 0.0, depth: 0.0, clarity: 0.0 },
            strengths: ['None'],
            improvements: [
              'Answer must address the technical prompt instead of prompt injection instructions.',
            ],
            conciseFeedback: 'Prompt injection or adversarial instruction detected in submission.',
            evidence: [],
            confidence: 0.99,
            missingConcepts: ['All technical concepts omitted due to prompt injection'],
            needsReview: true,
            safetyFlags: ['prompt_injection'],
          },
        };
      }
    }

    // 2. Protected Trait & Hiring Decision Inquiries
    const protectedTraitPatterns = [
      /infer\s+my\s+(age|gender|sex|race|ethnicity|mental\s+health|religion)/i,
      /should\s+a\s+company\s+hire\s+me/i,
      /make\s+a\s+hiring\s+decision/i,
      /determine\s+my\s+personality/i,
    ];

    for (const pattern of protectedTraitPatterns) {
      if (pattern.test(lowerAnswer)) {
        this.logger.warn(`Protected trait pattern detected in answer: ${pattern.source}`);
        return {
          isSafe: false,
          safetyFlags: ['protected_trait_request'],
          directEvaluation: {
            score: 2.0,
            rubricScores: { technicalAccuracy: 2.0, depth: 1.0, clarity: 3.0 },
            strengths: ['Communication attempted'],
            improvements: ['Please focus strictly on technical engineering topics.'],
            conciseFeedback:
              'System evaluates technical knowledge only and does not infer personal traits or make hiring decisions.',
            evidence: [],
            confidence: 0.95,
            missingConcepts: ['Technical implementation details'],
            needsReview: false,
            safetyFlags: ['protected_trait_request'],
          },
        };
      }
    }

    // 3. Verbosity / Keyword Stuffing Spam
    const cleanWords = lowerAnswer
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter(Boolean);

    if (cleanWords.length >= 5) {
      const wordCounts: Record<string, number> = {};
      for (const w of cleanWords) {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      }
      const maxRepetition = Math.max(...Object.values(wordCounts), 0);
      if (maxRepetition / cleanWords.length >= 0.3) {
        this.logger.warn(`Verbosity spam / keyword stuffing detected in submission`);
        return {
          isSafe: false,
          safetyFlags: ['verbosity_manipulation'],
          directEvaluation: {
            score: 2.5,
            rubricScores: { technicalAccuracy: 2.5, depth: 2.0, clarity: 3.0 },
            strengths: ['Identified domain keywords'],
            improvements: [
              'Avoid keyword repetition; provide substantive architectural explanations.',
            ],
            conciseFeedback:
              'Answer contains excessive keyword repetition without substantive engineering mechanism.',
            evidence: [`"${cleanWords.slice(0, 5).join(' ')}..."`],
            confidence: 0.85,
            missingConcepts: ['Concrete architectural implementation', 'Failure mode handling'],
            needsReview: false,
            safetyFlags: ['verbosity_manipulation'],
          },
        };
      }
    }

    return {
      isSafe: true,
      safetyFlags: [],
    };
  }

  /**
   * Post-processes evaluation output:
   * 1. Validates that every evidence quote is a verbatim substring of candidate answer.
   * 2. Recalculates deterministic application weighted score.
   * 3. Flags needsReview if confidence is low or safety violations occurred.
   */
  postFilter(
    context: EvaluationPromptContext,
    rawEvaluation: EvaluatedAnswerAi,
  ): EvaluatedAnswerAi {
    const rawAnswer = context.answer.trim();
    const lowerAnswer = rawAnswer.toLowerCase();

    // 1. Verbatim Evidence Verification
    const verifiedEvidence: string[] = [];
    const hadRawEvidence =
      Array.isArray(rawEvaluation.evidence) && rawEvaluation.evidence.length > 0;
    if (hadRawEvidence) {
      for (const quote of rawEvaluation.evidence) {
        if (!quote || typeof quote !== 'string') continue;
        // Clean outer quotation marks if wrapped by LLM
        const cleanQuote = quote.replace(/^["'«“]|["'»”]$/g, '').trim();
        if (cleanQuote.length > 0 && lowerAnswer.includes(cleanQuote.toLowerCase())) {
          verifiedEvidence.push(cleanQuote);
        }
      }
    }

    const safetyFlags = [...(rawEvaluation.safetyFlags || [])];
    let confidence = rawEvaluation.confidence ?? 0.85;

    // Flag ungrounded / hallucinated evidence if LLM provided quotes but none matched candidate text
    if (hadRawEvidence && verifiedEvidence.length === 0) {
      this.logger.warn(
        'LLM provided evidence quotes that could not be verified in candidate answer',
      );
      safetyFlags.push('unsubstantiated_evidence');
      confidence = Math.min(confidence, 0.5);
    }
    if (!hadRawEvidence) {
      safetyFlags.push('missing_evidence');
      confidence = Math.min(confidence, 0.6);
    }

    // 2. Deterministic Application-computed weighted score
    const technicalAccuracy = Math.min(
      10,
      Math.max(0, rawEvaluation.rubricScores.technicalAccuracy),
    );
    const depth = Math.min(10, Math.max(0, rawEvaluation.rubricScores.depth));
    const clarity = Math.min(10, Math.max(0, rawEvaluation.rubricScores.clarity));

    const calculatedScore = Number(
      (technicalAccuracy * 0.4 + depth * 0.3 + clarity * 0.3).toFixed(1),
    );

    // 3. Needs review flag determination
    const needsReview = rawEvaluation.needsReview || confidence < 0.7 || safetyFlags.length > 0;

    return {
      ...rawEvaluation,
      score: calculatedScore,
      rubricScores: {
        technicalAccuracy,
        depth,
        clarity,
      },
      evidence: verifiedEvidence,
      confidence,
      needsReview,
      safetyFlags: safetyFlags.length > 0 ? safetyFlags : undefined,
    };
  }
}
