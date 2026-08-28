import { NotFoundException } from '@nestjs/common';
import { TenantRole, UserRole } from '@ai-interview/contracts';
import { CohortAccessPolicy } from './cohort-access.policy';

describe('CohortAccessPolicy', () => {
  const policy = new CohortAccessPolicy();

  it.each([TenantRole.TENANT_ADMIN, TenantRole.INSTRUCTOR])(
    'allows tenant-wide read for %s while retaining the tenant predicate',
    tenantRole => {
      expect(
        policy.buildReadPredicate('cohort-1', {
          userId: 'staff-1',
          systemRole: UserRole.CANDIDATE,
          tenantRole,
          tenantId: 'tenant-1',
        }),
      ).toEqual({ id: 'cohort-1', tenantId: 'tenant-1' });
    },
  );

  it('requires both caller and tenant membership predicates for a student', () => {
    expect(
      policy.buildReadPredicate('cohort-1', {
        userId: 'student-1',
        systemRole: UserRole.CANDIDATE,
        tenantRole: TenantRole.STUDENT,
        tenantId: 'tenant-1',
      }),
    ).toEqual({
      id: 'cohort-1',
      tenantId: 'tenant-1',
      members: {
        some: {
          tenantMember: {
            is: { userId: 'student-1', tenantId: 'tenant-1' },
          },
        },
      },
    });
  });

  it('does not allow student access to analytics through an internal service call', () => {
    expect(() =>
      policy.buildReadPredicate(
        'cohort-1',
        {
          userId: 'student-1',
          systemRole: UserRole.CANDIDATE,
          tenantRole: TenantRole.STUDENT,
          tenantId: 'tenant-1',
        },
        { allowStudent: false },
      ),
    ).toThrow(NotFoundException);
  });
});
