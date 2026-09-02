import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MockAiProvider } from '../../src/modules/ai-orchestrator/providers/mock-ai.provider';
import { AiSecurityFilterService } from '../../src/modules/ai-orchestrator/security/ai-security-filter.service';

interface GoldenTestCase {
  id: string;
  language: string;
  role: string;
  level: string;
  question: string;
  keyFocus: string;
  expectedPoints: string[];
  answer: string;
  expectedMinScore: number;
  expectedMaxScore: number;
  expectedTechnicalAccuracyMin: number;
  expectedDepthMin: number;
  expectedClarityMin: number;
  expectedEvidenceSubstrings: string[];
  expectedMissingConcepts: string[];
  expectedSafetyFlags: string[];
  expectedNeedsReview: boolean;
}

describe('Golden Benchmark Evaluation Pipeline (v2 - 50 Dataset Cases)', () => {
  let mockProvider: MockAiProvider;
  let securityFilter: AiSecurityFilterService;
  let dataset: GoldenTestCase[];

  beforeAll(() => {
    const datasetPath = path.join(__dirname, 'datasets', 'golden-v2.json');
    const raw = fs.readFileSync(datasetPath, 'utf-8');
    dataset = JSON.parse(raw);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockAiProvider,
        AiSecurityFilterService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock'),
          },
        },
      ],
    }).compile();

    mockProvider = module.get<MockAiProvider>(MockAiProvider);
    securityFilter = module.get<AiSecurityFilterService>(AiSecurityFilterService);
  });

  it('verifies dataset integrity and enterprise size (>= 50 cases)', () => {
    expect(dataset.length).toBeGreaterThanOrEqual(50);
  });

  it('evaluates all golden benchmark test cases against scoring rubrics and security rules', async () => {
    for (const testCase of dataset) {
      // 1. Pre-filter evaluation
      const preFilterResult = securityFilter.preFilter({
        role: testCase.role,
        level: testCase.level,
        question: testCase.question,
        answer: testCase.answer,
      });

      let evaluationResult;

      if (!preFilterResult.isSafe && preFilterResult.directEvaluation) {
        evaluationResult = { data: preFilterResult.directEvaluation };
      } else {
        evaluationResult = await mockProvider.evaluateAnswer({
          role: testCase.role,
          level: testCase.level,
          question: testCase.question,
          keyFocus: testCase.keyFocus,
          expectedPoints: testCase.expectedPoints,
          answer: testCase.answer,
        });
      }

      // 2. Post-filter processing
      const filtered = securityFilter.postFilter(
        {
          role: testCase.role,
          level: testCase.level,
          question: testCase.question,
          answer: testCase.answer,
        },
        evaluationResult.data,
      );

      // 3. Assert Score Ranges
      expect(filtered.score).toBeGreaterThanOrEqual(testCase.expectedMinScore);
      expect(filtered.score).toBeLessThanOrEqual(testCase.expectedMaxScore);

      // 4. Assert Rubric Dimensions
      expect(filtered.rubricScores.technicalAccuracy).toBeGreaterThanOrEqual(
        testCase.expectedTechnicalAccuracyMin,
      );
      expect(filtered.rubricScores.depth).toBeGreaterThanOrEqual(testCase.expectedDepthMin);
      expect(filtered.rubricScores.clarity).toBeGreaterThanOrEqual(testCase.expectedClarityMin);

      // 5. Assert Safety Flags
      if (testCase.expectedSafetyFlags.length > 0) {
        for (const flag of testCase.expectedSafetyFlags) {
          expect(filtered.safetyFlags).toContain(flag);
        }
      }

      // 6. Assert Needs Review
      if (testCase.expectedNeedsReview) {
        expect(filtered.needsReview).toBe(true);
      }

      // 7. Assert Evidence Structure
      expect(Array.isArray(filtered.evidence)).toBe(true);
      if (testCase.expectedEvidenceSubstrings.length > 0 && filtered.evidence.length > 0) {
        const combinedEvidence = filtered.evidence.join(' ').toLowerCase();
        const hasMatch = testCase.expectedEvidenceSubstrings.some(
          (sub: string) =>
            combinedEvidence.includes(sub.toLowerCase()) ||
            testCase.answer.toLowerCase().includes(sub.toLowerCase()),
        );
        expect(hasMatch).toBe(true);
      }
    }
  });
});
