import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SemanticCacheService } from './semantic-cache.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { MetricsService } from '../../platform/metrics/metrics.service';

describe('SemanticCacheService (F013)', () => {
  let service: SemanticCacheService;
  let prismaMock: any;
  let configServiceMock: any;

  const mockDbCache: any[] = [];

  beforeEach(async () => {
    mockDbCache.length = 0;

    prismaMock = {
      semanticCache: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const item = mockDbCache.find(e => {
            if (where.promptHash && e.promptHash !== where.promptHash) return false;
            if (where.namespace !== undefined && e.namespace !== where.namespace) return false;
            if (where.userId !== undefined && e.userId !== where.userId) return false;
            return true;
          });
          return Promise.resolve(item || null);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(mockDbCache.find(e => e.promptHash === where.promptHash) || null);
        }),
        findMany: jest.fn().mockImplementation(({ where } = {}) => {
          let results = [...mockDbCache];
          if (where?.namespace !== undefined) {
            results = results.filter(e => e.namespace === where.namespace);
          }
          if (where?.userId !== undefined) {
            results = results.filter(e => e.userId === where.userId);
          }
          return Promise.resolve(results);
        }),
        upsert: jest.fn().mockImplementation(({ where, update, create }) => {
          const idx = mockDbCache.findIndex(e => e.promptHash === where.promptHash);
          if (idx >= 0) {
            mockDbCache[idx] = { ...mockDbCache[idx], ...update };
            return Promise.resolve(mockDbCache[idx]);
          } else {
            const newEntry = {
              id: 'cache-uuid-1',
              createdAt: new Date(),
              lastUsedAt: new Date(),
              hitCount: 0,
              ...create,
            };
            mockDbCache.push(newEntry);
            return Promise.resolve(newEntry);
          }
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const item = mockDbCache.find(e => e.id === where.id);
          if (item) {
            if (data.hitCount?.increment) item.hitCount += data.hitCount.increment;
            item.lastUsedAt = data.lastUsedAt || new Date();
          }
          return Promise.resolve(item);
        }),
        deleteMany: jest.fn().mockImplementation(() => {
          const count = mockDbCache.length;
          mockDbCache.length = 0;
          return Promise.resolve({ count });
        }),
        count: jest.fn().mockImplementation(() => Promise.resolve(mockDbCache.length)),
      },
    };

    configServiceMock = {
      get: jest.fn((key: string, defaultVal: any) => {
        if (key === 'features.semanticCache') return true;
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SemanticCacheService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: MetricsService, useValue: { aiCostUsdTotal: { inc: jest.fn() } } },
      ],
    }).compile();

    service = module.get<SemanticCacheService>(SemanticCacheService);
  });

  it('should generate deterministic hashes for identical prompt text regardless of whitespace/case', () => {
    const hash1 = service.generateHash('What is React reconciliation?');
    const hash2 = service.generateHash('  what is react reconciliation?  ');
    expect(hash1).toEqual(hash2);
  });

  it('should compute normalized vector embeddings and calculate cosine similarity', () => {
    const vec1 = service.generateEmbedding('explain kubernetes ingress and service mesh');
    const vec2 = service.generateEmbedding('explain kubernetes ingress and istio service mesh');
    const vec3 = service.generateEmbedding('recipe for homemade chocolate chip cookies');

    const similarityClose = service.calculateCosineSimilarity(vec1, vec2);
    const similarityDistant = service.calculateCosineSimilarity(vec1, vec3);

    expect(similarityClose).toBeGreaterThan(0.7);
    expect(similarityClose).toBeGreaterThan(similarityDistant);
  });

  it('should return cache miss when empty and store entry successfully', async () => {
    const prompt = 'Explain CAP Theorem in Distributed Databases';
    const miss = await service.get(prompt);
    expect(miss.hit).toBe(false);

    const payload = { score: 9.5, feedback: 'Accurate breakdown of Consistency vs Availability' };
    await service.set(prompt, payload);

    const hit = await service.get(prompt);
    expect(hit.hit).toBe(true);
    expect(hit.data).toEqual(payload);
    expect(hit.matchType).toBe('EXACT');
  });

  it('should return semantic hit when prompt is closely phrased above similarity threshold', async () => {
    const originalPrompt = 'How does garbage collection work in V8 JavaScript engine?';
    const payload = { explanation: 'Mark-and-sweep algorithm and generational heap' };
    await service.set(originalPrompt, payload);

    // Closely related query
    const variantPrompt = 'Explain garbage collection mechanism in JavaScript V8 engine';
    const result = await service.get(variantPrompt, 0.7); // lower threshold for term-based mock vector

    expect(result.hit).toBe(true);
    expect(result.data).toEqual(payload);
  });

  it('should calibrate default cosine similarity threshold to 0.92 (NEW-PERF-02)', () => {
    expect(service.getDefaultThreshold()).toBe(0.92);
  });

  it('should enforce cache isolation across different namespaces', async () => {
    const questionText = 'Design a rate limiter in distributed systems';
    const payloadQuestions = { template: 'Token bucket and sliding window counter' };

    // Set under namespace 'questions'
    await service.set(questionText, payloadQuestions, undefined, 86400, {
      namespace: 'questions',
    });

    // Namespace 'questions' gets hit
    const hitNamespace = await service.get(questionText, 0.92, { namespace: 'questions' });
    expect(hitNamespace.hit).toBe(true);
    expect(hitNamespace.data).toEqual(payloadQuestions);

    // Different namespace or un-namespaced query gets miss (isolation)
    const missOtherNamespace = await service.get(questionText, 0.92, { namespace: 'private-eval' });
    expect(missOtherNamespace.hit).toBe(false);
  });

  it('should invalidate all cache entries when requested', async () => {
    await service.set('Prompt 1', { data: 1 });
    await service.set('Prompt 2', { data: 2 });

    const beforeMetrics = await service.getMetrics();
    expect(beforeMetrics.totalEntries).toBe(2);

    const deleted = await service.invalidateAll();
    expect(deleted).toBe(2);

    const afterMetrics = await service.getMetrics();
    expect(afterMetrics.totalEntries).toBe(0);
  });
});
