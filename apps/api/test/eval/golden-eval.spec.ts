import { Test, TestingModule } from '@nestjs/testing';
import { MockAiProvider } from '../../src/modules/ai-orchestrator/providers/mock-ai.provider';

describe('M1 Golden Benchmark Evaluation Suite v2 (VI/EN)', () => {
  let mockProvider: MockAiProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockAiProvider],
    }).compile();

    mockProvider = module.get<MockAiProvider>(MockAiProvider);
  });

  it('golden_vi_strong_idempotency: should award high score and extract exact evidence for comprehensive Vietnamese answer', async () => {
    const viAnswer =
      'Client gửi idempotency key. Server tạo idempotency record và payment trong cùng transaction, có unique constraint theo user và operation. Nếu key đang xử lý thì trả trạng thái phù hợp; nếu hoàn tất thì replay response. Tôi theo dõi duplicate rate và conflict.';

    const result = await mockProvider.evaluateAnswer({
      role: 'Backend Engineer',
      level: 'Senior',
      question: 'Làm thế nào để thiết kế một API idempotent chống xử lý trùng lặp giao dịch?',
      answer: viAnswer,
    });

    // Score validation (8.5 - 10.0)
    expect(result.data.score).toBeGreaterThanOrEqual(8.5);
    expect(result.data.score).toBeLessThanOrEqual(10.0);

    // Rubric sub-scores
    expect(result.data.rubricScores.technicalAccuracy).toBeGreaterThanOrEqual(8.0);
    expect(result.data.rubricScores.depth).toBeGreaterThanOrEqual(8.0);
    expect(result.data.rubricScores.clarity).toBeGreaterThanOrEqual(8.0);

    // Evidence extraction
    expect(result.data.evidence.length).toBeGreaterThanOrEqual(2);
    const allEvidenceText = result.data.evidence.join(' ');
    expect(allEvidenceText).toContain('cùng transaction');
    expect(allEvidenceText).toContain('unique constraint');
    expect(allEvidenceText).toContain('replay response');

    // Confidence & review flag
    expect(result.data.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.data.needsReview).toBe(false);
  });

  it('golden_en_partial_idempotency: should award partial score and identify missing architectural concepts for brief answer', async () => {
    const enPartialAnswer =
      'I would attach a random request ID and retry the API when it times out.';

    const result = await mockProvider.evaluateAnswer({
      role: 'Backend Engineer',
      level: 'Senior',
      question: 'How do you design an idempotent API to prevent duplicate financial transactions under network retries?',
      answer: enPartialAnswer,
    });

    // Score interval validation (2.0 - 5.5)
    expect(result.data.score).toBeGreaterThanOrEqual(2.0);
    expect(result.data.score).toBeLessThanOrEqual(5.5);

    // Missing concepts identified
    expect(result.data.missingConcepts.length).toBeGreaterThan(0);
    expect(result.data.missingConcepts.some(c => c.includes('transaction') || c.includes('atomicity'))).toBe(true);

    // Evidence & confidence
    expect(result.data.confidence).toBeLessThanOrEqual(0.85);
    expect(result.data.needsReview).toBe(false);
  });

  it('golden_en_db_isolation_anomalies: should evaluate database isolation anomalies accurately', async () => {
    const enDbAnswer =
      'Read Uncommitted permits dirty reads. Read Committed prevents dirty reads using snapshot row reads. Repeatable Read prevents non-repeatable reads via MVCC or shared locks. Serializable prevents phantom reads using predicate locks or Strict Two-Phase Locking (2PL).';

    const result = await mockProvider.evaluateAnswer({
      role: 'Database Engineer',
      level: 'Senior',
      question: 'Explain database isolation levels and the anomalies they prevent (dirty read, non-repeatable read, phantom read).',
      answer: enDbAnswer,
    });

    expect(result.data.score).toBeGreaterThanOrEqual(8.5);
    expect(result.data.evidence.length).toBeGreaterThanOrEqual(2);
    expect(result.data.needsReview).toBe(false);
  });

  it('golden_vi_cache_invalidation: should evaluate Cache-Aside & Stampede strategy accurately', async () => {
    const viCacheAnswer =
      'Chiến lược Cache-Aside sẽ đọc từ Redis trước, nếu miss thì truy vấn database và cập nhật lại cache kèm TTL. Để giải quyết Cache Stampede, ta dùng Distributed Mutex Locking (Redlock) hoặc Probabilistic Early Expiration (XFetch algorithm) kết hợp background refresh.';

    const result = await mockProvider.evaluateAnswer({
      role: 'Backend Engineer',
      level: 'Senior',
      question: 'Giải thích chiến lược Cache-Aside và cách xử lý hiện tượng Cache Stampede / Thundering Herd?',
      answer: viCacheAnswer,
    });

    expect(result.data.score).toBeGreaterThanOrEqual(8.0);
    expect(result.data.evidence.length).toBeGreaterThanOrEqual(2);
    expect(result.data.needsReview).toBe(false);
  });
});
