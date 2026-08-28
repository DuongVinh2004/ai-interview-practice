import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ErrorCode } from '@ai-interview/contracts';

@Injectable()
export class B2bArenaTenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const challengeSlug = request.params?.slug || request.body?.challengeSlug;

    if (!challengeSlug) {
      return true; // No specific challenge targeted, proceed
    }

    const challenge = await this.prisma.engineeringChallenge.findUnique({
      where: { slug: challengeSlug },
      select: {
        id: true,
        slug: true,
        status: true,
        createdById: true,
      },
    });

    if (!challenge) {
      return true; // Let downstream service throw 404
    }

    // If challenge is in DRAFT/ARCHIVED status, only creator or admin can access
    if (challenge.status === 'DRAFT' || challenge.status === 'ARCHIVED') {
      const isCreator = user && user.id === challenge.createdById;
      const isAdmin = user && user.role === 'ADMIN';

      if (!isCreator && !isAdmin) {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'Access denied: This challenge is not published.',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return true;
  }
}
