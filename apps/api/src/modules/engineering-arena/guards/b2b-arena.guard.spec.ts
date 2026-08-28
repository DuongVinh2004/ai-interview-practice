import { B2bArenaTenantGuard } from './b2b-arena.guard';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ExecutionContext } from '@nestjs/common';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

describe('B2bArenaTenantGuard', () => {
  let guard: B2bArenaTenantGuard;
  let prisma: {
    engineeringChallenge: {
      findUnique: jest.Mock;
    };
  };

  const createMockContext = (user: any, params: any = {}, body: any = {}): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
          body,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    prisma = {
      engineeringChallenge: {
        findUnique: jest.fn(),
      },
    };
    guard = new B2bArenaTenantGuard(prisma as unknown as PrismaService);
  });

  it('allows access to PUBLISHED challenges for any authenticated user', async () => {
    prisma.engineeringChallenge.findUnique.mockResolvedValue({
      id: 'c1',
      slug: 'fix-memory-leak',
      status: 'PUBLISHED',
      createdById: 'admin-1',
    });

    const ctx = createMockContext({ id: 'candidate-1' }, { slug: 'fix-memory-leak' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('allows creator to access DRAFT challenge', async () => {
    prisma.engineeringChallenge.findUnique.mockResolvedValue({
      id: 'c2',
      slug: 'draft-challenge',
      status: 'DRAFT',
      createdById: 'author-123',
    });

    const ctx = createMockContext(
      { id: 'author-123', role: 'CANDIDATE' },
      { slug: 'draft-challenge' },
    );
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('allows ADMIN to access DRAFT challenge', async () => {
    prisma.engineeringChallenge.findUnique.mockResolvedValue({
      id: 'c2',
      slug: 'draft-challenge',
      status: 'DRAFT',
      createdById: 'author-123',
    });

    const ctx = createMockContext({ id: 'admin-user', role: 'ADMIN' }, { slug: 'draft-challenge' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('throws Forbidden if regular candidate tries to access DRAFT challenge', async () => {
    prisma.engineeringChallenge.findUnique.mockResolvedValue({
      id: 'c2',
      slug: 'draft-challenge',
      status: 'DRAFT',
      createdById: 'author-123',
    });

    const ctx = createMockContext(
      { id: 'other-candidate', role: 'CANDIDATE' },
      { slug: 'draft-challenge' },
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(DomainException);
  });
});
