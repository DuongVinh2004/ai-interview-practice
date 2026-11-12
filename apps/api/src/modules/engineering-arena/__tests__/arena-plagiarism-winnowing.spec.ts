import { ArenaAntiCheatService } from '../services/arena-anti-cheat.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  ArenaAntiCheatReport,
  ArenaAntiCheatReportSchema,
  PlagiarismReportSchema,
} from '@ai-interview/contracts';
import { EngineeringArenaController } from '../engineering-arena.controller';
import { EngineeringArenaService } from '../engineering-arena.service';

describe('Arena Plagiarism & Forensic Anti-Cheat Engine (Winnowing & Keystroke Dynamics)', () => {
  let service: ArenaAntiCheatService;
  let prisma: {
    arenaSession: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      arenaSession: {
        findUnique: jest.fn(),
      },
    };
    service = new ArenaAntiCheatService(prisma as unknown as PrismaService);
  });

  describe('AST Tokenization & Canonicalization', () => {
    it('normalizes identifiers, numbers, and strings while preserving keywords and operators', () => {
      const code = `
        // Compute sum of two values
        function calculateTotal(items: number[], multiplier: number): number {
          let runningSum = 0;
          for (let i = 0; i < items.length; i++) {
            runningSum += items[i] * multiplier;
          }
          return runningSum;
        }
      `;

      const tokens = service.tokenizeCode(code);
      expect(tokens.length).toBeGreaterThan(10);
      // Keywords preserved
      expect(tokens).toContain('function');
      expect(tokens).toContain('for');
      expect(tokens).toContain('return');
      expect(tokens).toContain('let');
      // Identifiers normalized to ID
      expect(tokens).toContain('ID');
      // Numbers normalized to NUM
      expect(tokens).toContain('NUM');
      // Comments stripped
      expect(tokens.join(' ')).not.toContain('Compute');
      expect(tokens.join(' ')).not.toContain('calculateTotal');
      expect(tokens.join(' ')).not.toContain('runningSum');
    });

    it('produces identical token sequences for structurally identical code with renamed variables', () => {
      const originalCode = `
        function binarySearch(array, target) {
          let low = 0;
          let high = array.length - 1;
          while (low <= high) {
            let mid = Math.floor((low + high) / 2);
            let val = array[mid];
            if (val === target) return mid;
            if (val < target) low = mid + 1;
            else high = mid - 1;
          }
          return -1;
        }
      `;

      const renamedCode = `
        function findElem(lst, key) {
          let startIdx = 0;
          let endIdx = lst.length - 1;
          while (startIdx <= endIdx) {
            let center = Math.floor((startIdx + endIdx) / 2);
            let curr = lst[center];
            if (curr === key) return center;
            if (curr < key) startIdx = center + 1;
            else endIdx = center - 1;
          }
          return -1;
        }
      `;

      const tokens1 = service.tokenizeCode(originalCode);
      const tokens2 = service.tokenizeCode(renamedCode);

      expect(tokens1).toEqual(tokens2);
    });
  });

  describe('Winnowing Fingerprinting Algorithm', () => {
    it('computes rolling hash k-grams and selects window minima conforming to Moss', () => {
      const sampleCode = `
        function bubbleSort(arr) {
          let len = arr.length;
          for (let i = 0; i < len; i++) {
            for (let j = 0; j < len - i - 1; j++) {
              if (arr[j] > arr[j + 1]) {
                let temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
              }
            }
          }
          return arr;
        }
      `;

      const fingerprints = service.computeWinnowingFingerprints(sampleCode, {
        kGramSize: 5,
        windowSize: 4,
      });

      expect(fingerprints.length).toBeGreaterThan(0);
      for (const fp of fingerprints) {
        expect(typeof fp.hash).toBe('number');
        expect(typeof fp.position).toBe('number');
      }
    });

    it('detects near 100% similarity when variables and function names are renamed', () => {
      const candidateCode = `
        function quicksort(elements) {
          if (elements.length <= 1) return elements;
          const pivot = elements[0];
          const smaller = [];
          const larger = [];
          for (let i = 1; i < elements.length; i++) {
            if (elements[i] < pivot) smaller.push(elements[i]);
            else larger.push(elements[i]);
          }
          return [...quicksort(smaller), pivot, ...quicksort(larger)];
        }
      `;

      const leakedSolution = `
        function sortArray(items) {
          if (items.length <= 1) return items;
          const sentinel = items[0];
          const leftPart = [];
          const rightPart = [];
          for (let idx = 1; idx < items.length; idx++) {
            if (items[idx] < sentinel) leftPart.push(items[idx]);
            else rightPart.push(items[idx]);
          }
          return [...sortArray(leftPart), sentinel, ...sortArray(rightPart)];
        }
      `;

      const match = service.compareCodeSnippets(candidateCode, leakedSolution, {
        kGramSize: 5,
        windowSize: 4,
        sourceFile: 'solution.ts',
        targetFile: 'reference.ts',
      });

      expect(match.similarityScore).toBeGreaterThanOrEqual(0.9);
      expect(match.matchedFingerprints).toBeGreaterThan(0);
      expect(match.totalFingerprints).toBeGreaterThan(0);
    });

    it('detects partial similarity when code blocks are shuffled with minor additions', () => {
      const original = `
        const a = 1;
        const b = 2;
        const c = a + b;
        function helper1() { return a * 2; }
        function helper2() { return b * 3; }
        const result = helper1() + helper2() + c;
      `;

      const shuffled = `
        function helper2() { return b * 3; }
        const a = 1;
        const extra = 999;
        function helper1() { return a * 2; }
        const b = 2;
        const c = a + b;
        const result = helper1() + helper2() + c;
      `;

      const match = service.compareCodeSnippets(original, shuffled, {
        kGramSize: 4,
        windowSize: 3,
        sourceFile: 'original.ts',
        targetFile: 'shuffled.ts',
      });

      expect(match.similarityScore).toBeGreaterThan(0.4);
      expect(match.similarityScore).toBeLessThan(1.0);
    });

    it('returns low similarity (< 0.20) for completely unrelated code implementations', () => {
      const code1 = `
        function dijkstra(graph, start) {
          const distances = {};
          const visited = new Set();
          for (const node of graph.nodes) distances[node] = Infinity;
          distances[start] = 0;
          return distances;
        }
      `;

      const code2 = `
        class LRUCache {
          constructor(capacity) {
            this.capacity = capacity;
            this.map = new Map();
          }
          get(key) {
            if (!this.map.has(key)) return -1;
            const val = this.map.get(key);
            this.map.delete(key);
            this.map.set(key, val);
            return val;
          }
        }
      `;

      const match = service.compareCodeSnippets(code1, code2, {
        kGramSize: 6,
        windowSize: 4,
        sourceFile: 'dijkstra.ts',
        targetFile: 'lru.ts',
      });

      expect(match.similarityScore).toBeLessThan(0.2);
    });
  });

  describe('Keystroke Dynamics & Velocity Anomaly Detection', () => {
    it('detects velocity anomaly when candidate pastes > 50 tokens in < 1000ms', () => {
      const rapidPasteMetadata = {
        pastedCharCount: 850,
        insertedTokens: 120,
        durationMs: 400,
      };

      const isAnomaly = service.checkKeystrokeVelocityAnomaly({
        metadata: rapidPasteMetadata,
      });

      expect(isAnomaly).toBe(true);
    });

    it('does not flag normal typing cadence (< 50 tokens per second or gradual keystrokes)', () => {
      const normalTypingMetadata = {
        pastedCharCount: 20,
        insertedTokens: 4,
        durationMs: 2500,
      };

      const isAnomaly = service.checkKeystrokeVelocityAnomaly({
        metadata: normalTypingMetadata,
      });

      expect(isAnomaly).toBe(false);
    });

    it('calculates velocity anomaly from action events sequence when durationMs is in event delta', () => {
      const events = [
        {
          sequence: 1,
          occurredAt: '2026-10-27T10:00:00.000Z',
          metadata: { insertedTokens: 5 },
        },
        {
          sequence: 2,
          occurredAt: '2026-10-27T10:00:00.600Z', // 600ms delta
          metadata: { insertedTokens: 90 }, // > 50 tokens in 600ms
        },
      ];

      const anomalies = service.analyzeActionEventsVelocity(events);
      expect(anomalies.length).toBe(1);
      expect(anomalies[0].sequence).toBe(2);
      expect(anomalies[0].tokens).toBe(90);
      expect(anomalies[0].durationMs).toBe(600);
    });
  });

  describe('Full Session Analysis with Plagiarism & Forensic Risk Score', () => {
    it('flags high forensic risk score when plagiarism match exceeds 85% and rapid paste is present', async () => {
      const leakedCode = `
        export class TokenBucketRateLimiter {
          private capacity: number;
          private tokens: number;
          private lastRefill: number;
          constructor(cap: number, fillRate: number) {
            this.capacity = cap;
            this.tokens = cap;
            this.lastRefill = Date.now();
          }
          public allowRequest(cost: number): boolean {
            this.refill();
            if (this.tokens >= cost) {
              this.tokens -= cost;
              return true;
            }
            return false;
          }
        }
      `;

      const candidateSubmission = `
        export class CustomLimiter {
          private maxCap: number;
          private currentTokens: number;
          private prevRefillTime: number;
          constructor(maxAmount: number, refillRate: number) {
            this.maxCap = maxAmount;
            this.currentTokens = maxAmount;
            this.prevRefillTime = Date.now();
          }
          public checkAllow(needed: number): boolean {
            this.refill();
            if (this.currentTokens >= needed) {
              this.currentTokens -= needed;
              return true;
            }
            return false;
          }
        }
      `;

      prisma.arenaSession.findUnique.mockResolvedValue({
        id: 'session-plagiarized-1',
        startedAt: new Date('2026-10-27T10:00:00.000Z'),
        submittedAt: new Date('2026-10-27T10:01:30.000Z'),
        challengeVersion: {
          challenge: { difficulty: 4 },
          manifestJson: {
            editableFiles: ['src/limiter.ts'],
          },
        },
        actionEvents: [
          {
            sequence: 1,
            occurredAt: '2026-10-27T10:00:30.000Z',
            metadata: {
              insertedTokens: 80,
              durationMs: 500, // < 1000ms velocity anomaly
              pastedCharCount: 600,
            },
          },
        ],
        executionRuns: [],
        submissions: [
          {
            id: 'sub-1',
            createdAt: new Date('2026-10-27T10:01:30.000Z'),
          },
        ],
      });

      const report: ArenaAntiCheatReport = await service.analyzeSession('session-plagiarized-1', {
        candidateFiles: [
          {
            path: 'src/limiter.ts',
            content: candidateSubmission,
          },
        ],
        comparisonSnippets: [
          {
            sourceId: 'leaked-sol-1',
            file: 'src/limiter.ts',
            content: leakedCode,
          },
        ],
      });

      expect(report.isSuspicious).toBe(true);
      expect(report.riskScore).toBeGreaterThanOrEqual(75);
      expect(report.plagiarismReport).toBeDefined();
      expect(report.plagiarismReport?.isPlagiarized).toBe(true);
      expect(report.plagiarismReport?.highestSimilarityScore).toBeGreaterThanOrEqual(0.85);
      expect(report.flags.some(f => f.ruleId === 'CODE_PLAGIARISM_DETECTED')).toBe(true);
      expect(report.flags.some(f => f.ruleId === 'KEYSTROKE_VELOCITY_ANOMALY')).toBe(true);

      // Validate contract schemas
      const validatedReport = ArenaAntiCheatReportSchema.safeParse(report);
      expect(validatedReport.success).toBe(true);
      const validatedPlagiarism = PlagiarismReportSchema.safeParse(report.plagiarismReport);
      expect(validatedPlagiarism.success).toBe(true);
    });
  });

  describe('EngineeringArenaController anti-cheat endpoint', () => {
    it('POST /arena/sessions/:id/anti-cheat/analyze delegates to arenaService.analyzeAntiCheat', async () => {
      const mockArenaService = {
        analyzeAntiCheat: jest.fn().mockResolvedValue({
          sessionId: 'sess-ctrl-1',
          isSuspicious: true,
          riskScore: 85,
          flags: [
            {
              ruleId: 'CODE_PLAGIARISM_DETECTED',
              description: 'High code similarity detected',
              severity: 'HIGH',
            },
          ],
          plagiarismReport: {
            sessionId: 'sess-ctrl-1',
            isPlagiarized: true,
            highestSimilarityScore: 0.95,
            forensicRiskScore: 85,
            matches: [],
            analyzedAt: new Date().toISOString(),
          },
          analyzedAt: new Date().toISOString(),
        }),
      } as unknown as EngineeringArenaService;

      const controller = new EngineeringArenaController(mockArenaService);
      const requestPayload = {
        candidateFiles: [{ path: 'main.ts', content: 'code' }],
      };

      const result = await controller.analyzeAntiCheat('u123', 'sess-ctrl-1', requestPayload);

      expect(mockArenaService.analyzeAntiCheat).toHaveBeenCalledWith(
        'sess-ctrl-1',
        'u123',
        requestPayload,
      );
      expect(result.sessionId).toBe('sess-ctrl-1');
      expect(result.riskScore).toBe(85);
      expect(result.isSuspicious).toBe(true);
    });
  });
});
