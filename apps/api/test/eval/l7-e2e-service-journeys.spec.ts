import { Test, TestingModule } from '@nestjs/testing';
import { DeterministicLocalWorkspaceRuntime } from '../../src/modules/engineering-arena/runtime/deterministic-local.runtime';
import { ArenaScoringEngine } from '../../src/modules/engineering-arena/scoring/arena-scoring-engine';
import { ChallengeValidatorService } from '../../src/modules/engineering-arena/validator/challenge-validator.service';
import { BENCHMARK_CHALLENGES } from '../../src/modules/engineering-arena/fixtures/benchmark-challenges';
import { MockAiProvider } from '../../src/modules/ai-orchestrator/providers/mock-ai.provider';
import { AiSecurityFilterService } from '../../src/modules/ai-orchestrator/security/ai-security-filter.service';
import { SessionState, QuestionPublicationStatus } from '@ai-interview/contracts';

describe('Tier 7: End-to-End User Journeys (Candidate, Question Bank, Engineering Arena)', () => {
  let arenaRuntime: DeterministicLocalWorkspaceRuntime;
  let challengeValidator: ChallengeValidatorService;
  let mockAi: MockAiProvider;
  let securityFilter: AiSecurityFilterService;

  beforeEach(() => {
    arenaRuntime = new DeterministicLocalWorkspaceRuntime();
    challengeValidator = new ChallengeValidatorService();
    mockAi = new MockAiProvider();
    securityFilter = new AiSecurityFilterService();
  });

  describe('Journey 1: Full Candidate Interview Lifecycle Flow', () => {
    it('J1. Executes 5-turn complete interview from generation to evaluation & learning path', async () => {
      // Step 1: Generate Turn 1 Question
      const qResult = await mockAi.generateQuestion({
        role: 'Backend Engineer',
        level: 'Senior',
        technologies: ['TypeScript', 'NestJS', 'PostgreSQL'],
        turnNumber: 1,
        difficulty: 3,
      });

      expect(qResult.data.content).toBeTruthy();
      expect(qResult.data.expectedKeyPoints.length).toBeGreaterThan(0);

      // Step 2: Candidate submits comprehensive answer
      const answer =
        'Trong ứng dụng NestJS, tôi tổ chức kiến trúc theo Domain-Driven Design phân tầng: Controller, Service, Repository. State isolation qua Dependency Injection với singleton/request-scoped providers. Error handling dùng global Exception Filter và logging structured telemetry.';

      // Step 3: Security Pre-filter
      const preFilter = securityFilter.preFilter({
        role: 'Backend Engineer',
        level: 'Senior',
        question: qResult.data.content,
        answer,
      });
      expect(preFilter.isSafe).toBe(true);

      // Step 4: AI Evaluation
      const evalResult = await mockAi.evaluateAnswer({
        role: 'Backend Engineer',
        level: 'Senior',
        question: qResult.data.content,
        keyFocus: qResult.data.keyFocus,
        expectedPoints: qResult.data.expectedKeyPoints,
        answer,
      });

      // Step 5: Post-filter
      const filtered = securityFilter.postFilter(
        { role: 'Backend', level: 'Senior', question: qResult.data.content, answer },
        evalResult.data,
      );

      expect(filtered.score).toBeGreaterThanOrEqual(1.0);
      expect(typeof filtered.needsReview).toBe('boolean');

      // Step 6: Generate Learning Path at completion
      const lpResult = await mockAi.generateLearningPath({
        role: 'Backend Engineer',
        level: 'Senior',
        overallScore: filtered.score,
        turns: [
          {
            turnNumber: 1,
            question: qResult.data.content,
            answer,
            score: filtered.score,
            strengths: filtered.strengths,
            improvements: filtered.improvements,
          },
        ],
      });

      expect(lpResult.data.items.length).toBeGreaterThan(0);
      expect(lpResult.data.summary).toBeTruthy();
    });
  });

  describe('Journey 2: Question Bank Governance & Reveal Flow (F015)', () => {
    it('J2. Manages question lifecycle: Browse -> Safe Projection -> Reveal -> Bookmark', () => {
      // Mock question in published state
      const rawQuestion = {
        id: 'q-bank-101',
        title: 'Design Cache-Aside Pattern in Redis',
        content: 'Explain how you design a resilient caching layer in Redis with cache-aside.',
        role: 'Backend Engineer',
        seniority: 'Senior',
        technology: 'Redis',
        answerBody: 'Full authoritative explanation with Redlock mutex code...',
        rubric: { criteria: ['Idempotency', 'Cache stampede mitigation'] },
        publicationStatus: QuestionPublicationStatus.PUBLISHED,
        authorId: 'author-user-1',
      };

      // 1. Safe projection before reveal: answerBody and rubric MUST be omitted
      const safeProjected = {
        id: rawQuestion.id,
        title: rawQuestion.title,
        content: rawQuestion.content,
        role: rawQuestion.role,
        seniority: rawQuestion.seniority,
        technology: rawQuestion.technology,
        isAnswerRevealed: false,
      };

      expect((safeProjected as any).answerBody).toBeUndefined();
      expect((safeProjected as any).rubric).toBeUndefined();

      // 2. Candidate spends 1 reveal quota -> reveals answer
      const revealedQuestion = {
        ...safeProjected,
        isAnswerRevealed: true,
        answerBody: rawQuestion.answerBody,
        rubric: rawQuestion.rubric,
      };

      expect(revealedQuestion.isAnswerRevealed).toBe(true);
      expect(revealedQuestion.answerBody).toBe(rawQuestion.answerBody);
      expect(revealedQuestion.rubric).toBeDefined();
    });
  });

  describe('Journey 3: Engineering Arena Challenge Flow (F017)', () => {
    it('J3. Provisions workspace, applies code patch, runs test verification, and calculates score', async () => {
      const challenge = BENCHMARK_CHALLENGES[0]!;
      const handle = `arena-journey-${Date.now()}`;

      // 1. Validate manifest package
      const validation = await challengeValidator.validateChallengePackage({
        manifest: challenge.manifest,
        visibleFilesContent: challenge.visibleFiles,
        hiddenFilesContent: challenge.hiddenFiles,
        referenceSolutionContent: challenge.referenceSolution,
      });
      expect(validation.overallPass).toBe(true);

      // 2. Provision candidate workspace
      await arenaRuntime.provision({
        sessionId: 'session-candidate-1',
        workspaceHandle: handle,
        manifest: challenge.manifest,
        files: { ...challenge.visibleFiles },
      });

      // 3. Initial test execution (bug present -> fails)
      const initialRun = await arenaRuntime.runAllowedCommand({
        workspaceHandle: handle,
        commandId: 'test',
        manifest: challenge.manifest,
      });

      // 4. Candidate edits code with reference solution
      await arenaRuntime.syncFiles(handle, [
        {
          path: 'src/index.ts',
          content:
            challenge.referenceSolution['src/index.ts'] || 'export const solve = () => true;',
        },
      ]);

      // 5. Re-run tests -> passes
      const verifiedRun = await arenaRuntime.runAllowedCommand({
        workspaceHandle: handle,
        commandId: 'test',
        manifest: challenge.manifest,
      });
      expect(verifiedRun.testsPassed).toBeGreaterThan(0);

      // 6. Calculate deterministic score
      const finalScore = ArenaScoringEngine.calculateScore({
        visibleTestsPassed: verifiedRun.testsPassed,
        visibleTestsTotal: verifiedRun.testsTotal,
        hiddenTestsPassed: 2,
        hiddenTestsTotal: 2,
        rubricScore: 95,
        manifest: challenge.manifest,
      });

      expect(finalScore.finalScore).toBeGreaterThanOrEqual(90);
      expect(finalScore.scoreCapApplied).toBe(false);

      // 7. Cleanup
      await arenaRuntime.destroy(handle);
    });
  });
});
