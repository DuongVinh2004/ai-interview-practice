import {
  ArenaChallengeManifest,
  ChallengeDomain,
  ChallengeCategory,
} from '@ai-interview/contracts';

export interface BenchmarkChallengeFixture {
  manifest: ArenaChallengeManifest;
  visibleFiles: Record<string, string>;
  hiddenFiles: Record<string, string>;
  referenceSolution: Record<string, string>;
}

export const BENCHMARK_CHALLENGES: BenchmarkChallengeFixture[] = [
  // 1. ARENA-070 — BOLA Security Challenge
  {
    manifest: {
      schemaVersion: '1.0',
      slug: 'fix-user-profile-bola',
      title: 'Fix Broken Object Level Authorization (BOLA) in Profile API',
      description:
        'Audit and fix BOLA vulnerability where candidates can update profiles belonging to other users.',
      domain: ChallengeDomain.SECURITY,
      category: ChallengeCategory.SECURITY_REMEDIATION,
      difficulty: 3,
      estimatedMinutes: 30,
      environment: {
        runtime: 'node:22',
        memoryLimitMb: 512,
        cpuLimit: 1.0,
      },
      visibleFiles: ['src/profile.controller.ts', 'test/profile.test.ts'],
      editableFiles: ['src/profile.controller.ts'],
      hiddenFiles: ['test/hidden-bola.test.ts'],
      commands: [
        {
          id: 'test',
          label: 'Run Unit Tests',
          command: 'npm test',
          args: [],
          timeoutSeconds: 15,
          isVerification: false,
        },
      ],
      rubric: {
        version: '1.0',
        objectiveWeight: 0.7,
        rubricWeight: 0.3,
        criteria: [
          {
            key: 'auth_scoping',
            name: 'Authorization Scoping',
            description: 'Enforce current user ID check against requested profile ID.',
            maxPoints: 50,
          },
        ],
      },
      skills: [{ taxonomyKey: 'security_authorization_bola', weight: 1.0 }],
    },
    visibleFiles: {
      'src/profile.controller.ts': `export class ProfileController {
  async updateProfile(currentUser: { id: string }, targetProfileId: string, data: any, db: any) {
    // BUG: Missing authorization check! Directly updating without checking ownership
    return db.update('UserProfile', targetProfileId, data);
  }
}`,
      'test/profile.test.ts': `test("should update own profile", () => {
  const ctrl = new ProfileController();
  expect(ctrl).toBeDefined();
});`,
    },
    hiddenFiles: {
      'test/hidden-bola.test.ts': `test("rejects cross-user profile modification", () => {});`,
    },
    referenceSolution: {
      'src/profile.controller.ts': `export class ProfileController {
  async updateProfile(currentUser: { id: string }, targetProfileId: string, data: any, db: any) {
    if (currentUser.id !== targetProfileId) {
      throw new Error("Forbidden: Cannot modify another user's profile");
    }
    return db.update('UserProfile', targetProfileId, data);
  }
}`,
    },
  },

  // 2. ARENA-071 — N+1 Performance Challenge
  {
    manifest: {
      schemaVersion: '1.0',
      slug: 'optimize-graphql-n-plus-one',
      title: 'Optimize N+1 Query Amplification in Batch DataLoader',
      description:
        'Implement DataLoader batching to eliminate N+1 SQL queries when resolving author details.',
      domain: ChallengeDomain.BACKEND,
      category: ChallengeCategory.PERFORMANCE_OPTIMIZATION,
      difficulty: 4,
      estimatedMinutes: 45,
      environment: {
        runtime: 'node:22',
        memoryLimitMb: 512,
        cpuLimit: 1.0,
      },
      visibleFiles: ['src/author.loader.ts', 'test/author.loader.test.ts'],
      editableFiles: ['src/author.loader.ts'],
      hiddenFiles: ['test/hidden-dataloader.test.ts'],
      commands: [
        {
          id: 'test',
          label: 'Run Benchmark Tests',
          command: 'npm test',
          args: [],
          timeoutSeconds: 15,
          isVerification: false,
        },
      ],
      rubric: {
        version: '1.0',
        objectiveWeight: 0.7,
        rubricWeight: 0.3,
        criteria: [
          {
            key: 'dataloader_batching',
            name: 'Batch Query Resolution',
            description: 'Queries database once for all distinct keys in batch.',
            maxPoints: 50,
          },
        ],
      },
      skills: [{ taxonomyKey: 'database_performance_n_plus_one', weight: 1.0 }],
    },
    visibleFiles: {
      'src/author.loader.ts': `export class AuthorLoader {
  async loadAuthors(bookAuthorIds: string[], db: any) {
    // BUG: Iterative SQL query causing N+1
    const results = [];
    for (const id of bookAuthorIds) {
      results.push(await db.query('SELECT * FROM authors WHERE id = ?', id));
    }
    return results;
  }
}`,
      'test/author.loader.test.ts': `test("loads author data", () => {});`,
    },
    hiddenFiles: {
      'test/hidden-dataloader.test.ts': `test("executes single IN query", () => {});`,
    },
    referenceSolution: {
      'src/author.loader.ts': `export class AuthorLoader {
  async loadAuthors(bookAuthorIds: string[], db: any) {
    const uniqueIds = Array.from(new Set(bookAuthorIds));
    const authors = await db.query('SELECT * FROM authors WHERE id IN (?)', uniqueIds);
    const authorMap = new Map(authors.map((a: any) => [a.id, a]));
    return bookAuthorIds.map((id) => authorMap.get(id));
  }
}`,
    },
  },

  // 3. ARENA-072 — Concurrency / Inventory Oversell Challenge
  {
    manifest: {
      schemaVersion: '1.0',
      slug: 'fix-inventory-oversell-race',
      title: 'Fix Race Condition and Inventory Oversell Under High Concurrency',
      description:
        'Prevent overselling products when multiple concurrent orders arrive simultaneously.',
      domain: ChallengeDomain.BACKEND,
      category: ChallengeCategory.BUG_FIX,
      difficulty: 4,
      estimatedMinutes: 40,
      environment: {
        runtime: 'node:22',
        memoryLimitMb: 512,
        cpuLimit: 1.0,
      },
      visibleFiles: ['src/inventory.service.ts', 'test/inventory.test.ts'],
      editableFiles: ['src/inventory.service.ts'],
      hiddenFiles: ['test/hidden-concurrency.test.ts'],
      commands: [
        {
          id: 'test',
          label: 'Run Concurrency Tests',
          command: 'npm test',
          args: [],
          timeoutSeconds: 15,
          isVerification: false,
        },
      ],
      rubric: {
        version: '1.0',
        objectiveWeight: 0.7,
        rubricWeight: 0.3,
        criteria: [
          {
            key: 'atomic_reservation',
            name: 'Atomic Stock Reservation',
            description: 'Uses optimistic concurrency or atomic conditional decrement.',
            maxPoints: 50,
          },
        ],
      },
      skills: [{ taxonomyKey: 'concurrency_race_condition', weight: 1.0 }],
    },
    visibleFiles: {
      'src/inventory.service.ts': `export class InventoryService {
  async reserveStock(productId: string, quantity: number, db: any) {
    // BUG: Check-then-act race condition!
    const product = await db.findOne('Product', productId);
    if (product.stock >= quantity) {
      product.stock -= quantity;
      await db.update('Product', productId, { stock: product.stock });
      return true;
    }
    return false;
  }
}`,
      'test/inventory.test.ts': `test("reserves stock", () => {});`,
    },
    hiddenFiles: {
      'test/hidden-concurrency.test.ts': `test("100 concurrent requests never oversell", () => {});`,
    },
    referenceSolution: {
      'src/inventory.service.ts': `export class InventoryService {
  async reserveStock(productId: string, quantity: number, db: any) {
    const updated = await db.execute(
      'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
      [quantity, productId, quantity],
    );
    return updated.affectedRows > 0;
  }
}`,
    },
  },

  // 4. ARENA-073 — JWT / Session Replay Security Challenge
  {
    manifest: {
      schemaVersion: '1.0',
      slug: 'harden-jwt-session-replay',
      title: 'Harden Refresh Token Family against Token Replay and Theft',
      description:
        'Implement token rotation and automatic family invalidation when a compromised refresh token is reused.',
      domain: ChallengeDomain.SECURITY,
      category: ChallengeCategory.SECURITY_REMEDIATION,
      difficulty: 4,
      estimatedMinutes: 45,
      environment: {
        runtime: 'node:22',
        memoryLimitMb: 512,
        cpuLimit: 1.0,
      },
      visibleFiles: ['src/token.service.ts', 'test/token.test.ts'],
      editableFiles: ['src/token.service.ts'],
      hiddenFiles: ['test/hidden-token-family.test.ts'],
      commands: [
        {
          id: 'test',
          label: 'Run Auth Tests',
          command: 'npm test',
          args: [],
          timeoutSeconds: 15,
          isVerification: false,
        },
      ],
      rubric: {
        version: '1.0',
        objectiveWeight: 0.7,
        rubricWeight: 0.3,
        criteria: [
          {
            key: 'token_family_revocation',
            name: 'Token Family Invalidation',
            description:
              'Revokes all descendant tokens if an already-used refresh token is presented.',
            maxPoints: 50,
          },
        ],
      },
      skills: [{ taxonomyKey: 'security_jwt_token_rotation', weight: 1.0 }],
    },
    visibleFiles: {
      'src/token.service.ts': `export class TokenService {
  async rotateRefreshToken(token: string, db: any) {
    // BUG: Missing token reuse detection
    const record = await db.findToken(token);
    if (!record || record.isRevoked) throw new Error("Invalid token");
    await db.revokeToken(token);
    return db.generateNewToken(record.userId);
  }
}`,
      'test/token.test.ts': `test("rotates token", () => {});`,
    },
    hiddenFiles: {
      'test/hidden-token-family.test.ts': `test("revokes entire family on replay", () => {});`,
    },
    referenceSolution: {
      'src/token.service.ts': `export class TokenService {
  async rotateRefreshToken(token: string, db: any) {
    const record = await db.findToken(token);
    if (!record) throw new Error("Token not found");
    if (record.isRevoked) {
      // Token reuse detected! Invalidate entire token family for this user
      await db.revokeAllTokensForUser(record.userId);
      throw new Error("Security Breach: Compromised token reuse detected");
    }
    await db.revokeToken(token);
    return db.generateNewToken(record.userId, record.familyId);
  }
}`,
    },
  },

  // 5. ARENA-074 — Queue Idempotency Challenge
  {
    manifest: {
      schemaVersion: '1.0',
      slug: 'idempotent-payment-webhook-worker',
      title: 'Implement Idempotent Payment Webhook Queue Consumer',
      description:
        'Ensure payment webhooks can be retried safely without double-charging or duplicate order fulfillment.',
      domain: ChallengeDomain.BACKEND,
      category: ChallengeCategory.BUG_FIX,
      difficulty: 3,
      estimatedMinutes: 35,
      environment: {
        runtime: 'node:22',
        memoryLimitMb: 512,
        cpuLimit: 1.0,
      },
      visibleFiles: ['src/payment-worker.ts', 'test/payment-worker.test.ts'],
      editableFiles: ['src/payment-worker.ts'],
      hiddenFiles: ['test/hidden-webhook-idempotency.test.ts'],
      commands: [
        {
          id: 'test',
          label: 'Run Worker Tests',
          command: 'npm test',
          args: [],
          timeoutSeconds: 15,
          isVerification: false,
        },
      ],
      rubric: {
        version: '1.0',
        objectiveWeight: 0.7,
        rubricWeight: 0.3,
        criteria: [
          {
            key: 'idempotent_processing',
            name: 'Idempotent Ledger Writing',
            description: 'Uses unique event ID constraint or idempotency lock table.',
            maxPoints: 50,
          },
        ],
      },
      skills: [{ taxonomyKey: 'queue_idempotency_distributed_systems', weight: 1.0 }],
    },
    visibleFiles: {
      'src/payment-worker.ts': `export class PaymentWebhookWorker {
  async processWebhook(event: { id: string; amount: number; userId: string }, db: any) {
    // BUG: Missing idempotency check, creates duplicate credits on retry!
    await db.creditBalance(event.userId, event.amount);
    await db.markOrderPaid(event.id);
  }
}`,
      'test/payment-worker.test.ts': `test("processes payment", () => {});`,
    },
    hiddenFiles: {
      'test/hidden-webhook-idempotency.test.ts': `test("retried webhook is a no-op", () => {});`,
    },
    referenceSolution: {
      'src/payment-worker.ts': `export class PaymentWebhookWorker {
  async processWebhook(event: { id: string; amount: number; userId: string }, db: any) {
    const isInserted = await db.insertIdempotencyKey(event.id);
    if (!isInserted) {
      return; // Already processed, acknowledge and return cleanly
    }
    await db.creditBalance(event.userId, event.amount);
    await db.markOrderPaid(event.id);
  }
}`,
    },
  },
];
