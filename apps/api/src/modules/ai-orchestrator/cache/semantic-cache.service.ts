import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { MetricsService } from '../../platform/metrics/metrics.service';

export interface CacheLookupResult<T> {
  hit: boolean;
  data?: T;
  similarity?: number;
  matchType?: 'EXACT' | 'SEMANTIC';
}

@Injectable()
export class SemanticCacheService {
  private readonly logger = new Logger(SemanticCacheService.name);
  private readonly defaultThreshold = 0.92;
  private readonly isEnabled: boolean;
  private cacheHitsTotal = 0;
  private cacheMissesTotal = 0;
  private estimatedSavingsUsd = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {
    this.isEnabled = this.configService.get<boolean>('features.semanticCache', false);
  }

  getDefaultThreshold(): number {
    return this.defaultThreshold;
  }

  isCacheEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Generates a deterministic SHA-256 hash for exact-match fast lookup.
   */
  generateHash(text: string): string {
    return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
  }

  /**
   * Generates a normalized vector embedding. In offline/mock mode, produces
   * a deterministic 64-dimensional normalized term-frequency feature vector.
   */
  generateEmbedding(text: string): number[] {
    const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = clean.split(/\s+/).filter(Boolean);
    const vectorDim = 64;
    const vector = new Array(vectorDim).fill(0);

    for (const token of tokens) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      const index = Math.abs(hash) % vectorDim;
      vector[index] += 1;
    }

    // Normalize vector to unit length
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
  }

  /**
   * Calculates cosine similarity between two unit vectors.
   */
  calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;
    return Math.min(1, Math.max(0, dotProduct / denominator));
  }

  /**
   * Searches cache for exact or semantic matches.
   */
  async get<T>(
    promptText: string,
    threshold: number = this.defaultThreshold,
    options?: { namespace?: string; userId?: string },
  ): Promise<CacheLookupResult<T>> {
    if (!this.isEnabled) {
      return { hit: false };
    }

    const namespacePrefix = options?.namespace ? `${options.namespace}:` : '';
    const userPrefix = options?.userId ? `user:${options.userId}:` : '';
    const fullKey = `${namespacePrefix}${userPrefix}${promptText}`;
    const promptHash = this.generateHash(fullKey);

    try {
      // 1. Fast path: Exact prompt hash lookup
      const exactMatch = await this.prisma.semanticCache.findFirst({
        where: {
          promptHash,
          ...(options?.namespace !== undefined ? { namespace: options.namespace } : {}),
          ...(options?.userId !== undefined ? { userId: options.userId } : {}),
        },
      });

      if (exactMatch) {
        const isExpired =
          Date.now() - exactMatch.createdAt.getTime() > exactMatch.ttlSeconds * 1000;
        if (!isExpired) {
          await this.prisma.semanticCache.update({
            where: { id: exactMatch.id },
            data: {
              hitCount: { increment: 1 },
              lastUsedAt: new Date(),
            },
          });
          this.recordHit(0.002);
          return {
            hit: true,
            data: exactMatch.responsePayload as T,
            similarity: 1.0,
            matchType: 'EXACT',
          };
        }
      }

      // 2. Semantic search over recent cache entries partitioned by namespace/userId
      const queryEmbedding = this.generateEmbedding(promptText);
      const recentEntries = await this.prisma.semanticCache.findMany({
        where: {
          ...(options?.namespace !== undefined ? { namespace: options.namespace } : {}),
          ...(options?.userId !== undefined ? { userId: options.userId } : {}),
        },
        take: 100,
        orderBy: { lastUsedAt: 'desc' },
      });

      let bestMatch: (typeof recentEntries)[0] | null = null;
      let highestSimilarity = 0;

      for (const entry of recentEntries) {
        if (entry.embedding && entry.embedding.length > 0) {
          const sim = this.calculateCosineSimilarity(queryEmbedding, entry.embedding);
          if (sim > highestSimilarity) {
            highestSimilarity = sim;
            bestMatch = entry;
          }
        }
      }

      if (bestMatch && highestSimilarity >= threshold) {
        const isExpired = Date.now() - bestMatch.createdAt.getTime() > bestMatch.ttlSeconds * 1000;
        if (!isExpired) {
          await this.prisma.semanticCache.update({
            where: { id: bestMatch.id },
            data: {
              hitCount: { increment: 1 },
              lastUsedAt: new Date(),
            },
          });
          this.recordHit(0.002);
          return {
            hit: true,
            data: bestMatch.responsePayload as T,
            similarity: highestSimilarity,
            matchType: 'SEMANTIC',
          };
        }
      }

      this.cacheMissesTotal++;
      return { hit: false };
    } catch (err: any) {
      this.logger.warn(`Semantic cache lookup error: ${err.message}`);
      return { hit: false };
    }
  }

  /**
   * Stores an AI response in the semantic cache with optional namespace and user partitioning.
   */
  async set(
    promptText: string,
    responsePayload: any,
    metadata?: Record<string, any>,
    ttlSeconds = 86400,
    options?: { namespace?: string; userId?: string },
  ): Promise<void> {
    if (!this.isEnabled) return;

    const namespacePrefix = options?.namespace ? `${options.namespace}:` : '';
    const userPrefix = options?.userId ? `user:${options.userId}:` : '';
    const fullKey = `${namespacePrefix}${userPrefix}${promptText}`;
    const promptHash = this.generateHash(fullKey);
    const embedding = this.generateEmbedding(promptText);

    try {
      await this.prisma.semanticCache.upsert({
        where: { promptHash },
        update: {
          promptText,
          namespace: options?.namespace,
          userId: options?.userId,
          embedding,
          responsePayload,
          metadata: metadata || {},
          ttlSeconds,
          lastUsedAt: new Date(),
        },
        create: {
          promptHash,
          namespace: options?.namespace,
          userId: options?.userId,
          promptText,
          embedding,
          responsePayload,
          metadata: metadata || {},
          ttlSeconds,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to store semantic cache entry: ${err.message}`);
    }
  }

  private recordHit(estimatedCostPerCall = 0.002) {
    this.cacheHitsTotal++;
    this.estimatedSavingsUsd += estimatedCostPerCall;
    this.metricsService?.aiCostUsdTotal.inc({ provider: 'semantic_cache', model: 'cached' }, 0);
  }

  /**
   * Invalidate cache entries by metadata filter or purge all.
   */
  async invalidateAll(): Promise<number> {
    const deleteResult = await this.prisma.semanticCache.deleteMany({});
    return deleteResult.count;
  }

  async getMetrics() {
    const totalEntries = await this.prisma.semanticCache.count().catch(() => 0);
    const totalRequests = this.cacheHitsTotal + this.cacheMissesTotal;
    const hitRate = totalRequests > 0 ? (this.cacheHitsTotal / totalRequests) * 100 : 0;

    return {
      isEnabled: this.isEnabled,
      totalEntries,
      cacheHitsTotal: this.cacheHitsTotal,
      cacheMissesTotal: this.cacheMissesTotal,
      hitRatePercent: parseFloat(hitRate.toFixed(2)),
      estimatedSavingsUsd: parseFloat(this.estimatedSavingsUsd.toFixed(4)),
    };
  }
}
