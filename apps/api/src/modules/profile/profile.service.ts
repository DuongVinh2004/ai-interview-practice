import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { ErrorCode } from '@ai-interview/contracts';
import { UpdateProfileRequestDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, email: true, role: true, status: true, createdAt: true },
        },
      },
    });

    if (!profile) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Profile not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileRequestDto) {
    return this.prisma.userProfile.upsert({
      where: { userId },
      update: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.targetRole !== undefined ? { targetRole: dto.targetRole } : {}),
        ...(dto.targetLevel !== undefined ? { targetLevel: dto.targetLevel } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
      },
      create: {
        userId,
        fullName: dto.fullName || 'Candidate',
        targetRole: dto.targetRole,
        targetLevel: dto.targetLevel,
        bio: dto.bio,
      },
    });
  }
}
