import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantRole, UserRole } from '@ai-interview/contracts';

export interface CohortAccessContext {
  userId: string;
  systemRole?: UserRole | string;
  tenantRole?: TenantRole | string;
  tenantId: string;
}

@Injectable()
export class CohortAccessPolicy {
  isStudent(context: CohortAccessContext): boolean {
    return context.systemRole !== UserRole.ADMIN && context.tenantRole === TenantRole.STUDENT;
  }

  buildReadPredicate(
    cohortId: string,
    context: CohortAccessContext,
    options: { allowStudent?: boolean } = {},
  ): any {
    const base = { id: cohortId, tenantId: context.tenantId };
    if (
      context.systemRole === UserRole.ADMIN ||
      context.tenantRole === TenantRole.TENANT_ADMIN ||
      context.tenantRole === TenantRole.INSTRUCTOR
    ) {
      return base;
    }

    if (context.tenantRole === TenantRole.STUDENT && options.allowStudent !== false) {
      return {
        ...base,
        members: {
          some: {
            tenantMember: {
              is: {
                userId: context.userId,
                tenantId: context.tenantId,
              },
            },
          },
        },
      };
    }

    throw new NotFoundException('Cohort not found in this organization');
  }
}
