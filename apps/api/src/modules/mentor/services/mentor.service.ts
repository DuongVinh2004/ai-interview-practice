import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CreateMentorProfileDto, SetAvailabilityDto } from '../dto/mentor.dto';

@Injectable()
export class MentorService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateMentorProfile(userId: string) {
    let profile = await this.prisma.mentorProfile.findUnique({
      where: { userId },
      include: {
        availabilities: { where: { isActive: true } },
        user: { include: { profile: true } },
      },
    });

    if (!profile) {
      profile = await this.prisma.mentorProfile.create({
        data: {
          userId,
          expertiseAreas: ['System Design', 'Backend Architecture'],
          bio: 'Experienced engineering mentor ready to help you succeed in tech interviews.',
          isActive: true,
        },
        include: {
          availabilities: true,
          user: { include: { profile: true } },
        },
      });
    }

    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.user.profile?.fullName || profile.user.email.split('@')[0],
      expertiseAreas: profile.expertiseAreas,
      rating: profile.rating,
      totalSessions: profile.totalSessions,
      bio: profile.bio,
      isActive: profile.isActive,
      availabilities: profile.availabilities,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  async createOrUpdateProfile(userId: string, dto: CreateMentorProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.mentorProfile.upsert({
      where: { userId },
      update: {
        expertiseAreas: dto.expertiseAreas,
        ...(dto.bio !== undefined && { bio: dto.bio }),
      },
      create: {
        userId,
        expertiseAreas: dto.expertiseAreas,
        bio: dto.bio || null,
        isActive: true,
      },
      include: {
        availabilities: true,
        user: { include: { profile: true } },
      },
    });

    if (dto.availabilities && dto.availabilities.length > 0) {
      // Replace availabilities
      await this.prisma.mentorAvailability.deleteMany({
        where: { mentorId: updated.id },
      });

      await this.prisma.mentorAvailability.createMany({
        data: dto.availabilities.map(slot => ({
          mentorId: updated.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isActive: slot.isActive !== false,
        })),
      });
    }

    return this.getOrCreateMentorProfile(userId);
  }

  async setAvailability(userId: string, dto: SetAvailabilityDto) {
    const profile = await this.getOrCreateMentorProfile(userId);

    await this.prisma.mentorAvailability.deleteMany({
      where: { mentorId: profile.id },
    });

    if (dto.slots && dto.slots.length > 0) {
      await this.prisma.mentorAvailability.createMany({
        data: dto.slots.map(slot => ({
          mentorId: profile.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isActive: slot.isActive !== false,
        })),
      });
    }

    return this.getMentorAvailability(profile.id);
  }

  async getMentorAvailability(mentorId: string) {
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { id: mentorId },
      include: {
        availabilities: { where: { isActive: true } },
        user: { include: { profile: true } },
      },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor not found');
    }

    return {
      mentorId: mentor.id,
      mentorName: mentor.user.profile?.fullName || mentor.user.email.split('@')[0],
      rating: mentor.rating,
      totalSessions: mentor.totalSessions,
      expertiseAreas: mentor.expertiseAreas,
      bio: mentor.bio,
      slots: mentor.availabilities,
    };
  }

  async listMentors(expertise?: string) {
    const mentors = await this.prisma.mentorProfile.findMany({
      where: {
        isActive: true,
        ...(expertise && {
          expertiseAreas: {
            has: expertise,
          },
        }),
      },
      include: {
        availabilities: { where: { isActive: true } },
        user: { include: { profile: true } },
      },
      orderBy: [{ rating: 'desc' }, { totalSessions: 'desc' }],
    });

    return mentors.map(m => ({
      id: m.id,
      userId: m.userId,
      fullName: m.user.profile?.fullName || m.user.email.split('@')[0],
      expertiseAreas: m.expertiseAreas,
      rating: m.rating,
      totalSessions: m.totalSessions,
      bio: m.bio,
      availabilities: m.availabilities,
      createdAt: m.createdAt,
    }));
  }
}
