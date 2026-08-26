import {
  TenantContextMiddleware,
  RequestWithTenant,
} from '../middleware/tenant-context.middleware';

describe('TenantContextMiddleware Fail-Closed Policy (F-014)', () => {
  let middleware: TenantContextMiddleware;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      tenantMember: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
    };
    middleware = new TenantContextMiddleware(mockPrisma as any);
  });

  it('MUST resolve tenant if explicit x-tenant-id header is provided and user is a member', async () => {
    const req: RequestWithTenant = {
      headers: { 'x-tenant-id': 'tenant-123' },
      user: { sub: 'user-1' },
    } as any;
    const res: any = {};
    const next = jest.fn();

    mockPrisma.tenantMember.findUnique.mockResolvedValue({
      tenantId: 'tenant-123',
      userId: 'user-1',
      role: 'STUDENT',
    });

    await middleware.use(req, res, next);

    expect(req.tenantId).toBe('tenant-123');
    expect(req.tenantRole).toBe('STUDENT');
    expect(next).toHaveBeenCalled();
  });

  it('MUST auto-resolve only when user belongs to EXACTLY 1 tenant and no header is sent', async () => {
    const req: RequestWithTenant = {
      headers: {},
      user: { sub: 'user-single-tenant' },
    } as any;
    const res: any = {};
    const next = jest.fn();

    mockPrisma.tenantMember.count.mockResolvedValue(1);
    mockPrisma.tenantMember.findFirst.mockResolvedValue({
      tenantId: 'tenant-single',
      role: 'INSTRUCTOR',
    });

    await middleware.use(req, res, next);

    expect(req.tenantId).toBe('tenant-single');
    expect(req.tenantRole).toBe('INSTRUCTOR');
    expect(next).toHaveBeenCalled();
  });

  it('MUST NOT auto-resolve (fail-closed) when user belongs to MULTIPLE tenants and header is missing', async () => {
    const req: RequestWithTenant = {
      headers: {},
      user: { sub: 'user-multi-tenant' },
    } as any;
    const res: any = {};
    const next = jest.fn();

    mockPrisma.tenantMember.count.mockResolvedValue(3); // User in 3 organizations

    await middleware.use(req, res, next);

    // Must be undefined to prevent accidental operations in the wrong tenant context
    expect(req.tenantId).toBeUndefined();
    expect(req.tenantRole).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
