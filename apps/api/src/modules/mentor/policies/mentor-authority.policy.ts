import { ForbiddenException, Injectable } from '@nestjs/common';
import { MentorAuthorityState } from '@ai-interview/contracts';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class MentorAuthorityPolicy {
  constructor(private readonly prisma: PrismaService) {}

  async requireApprovedByUser(userId: string, client: any = this.prisma): Promise<any> {
    const profile = await client.mentorProfile.findFirst({
      where: {
        userId,
        authorityState: MentorAuthorityState.APPROVED,
        isActive: true,
      },
    });
    if (!profile) {
      throw new ForbiddenException('Approved mentor authority is required');
    }
    return profile;
  }

  async requireApprovedById(mentorId: string, client: any = this.prisma): Promise<any> {
    const profile = await client.mentorProfile.findFirst({
      where: {
        id: mentorId,
        authorityState: MentorAuthorityState.APPROVED,
        isActive: true,
      },
    });
    if (!profile) {
      throw new ForbiddenException('Approved mentor authority is required');
    }
    return profile;
  }
}
