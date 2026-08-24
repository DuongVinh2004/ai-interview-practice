import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { SystemDesignSessionDto, CanvasSnapshotDto } from '@ai-interview/contracts';

@Injectable()
export class CanvasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initialize a system design whiteboard session
   */
  async initSession(interviewId: string, initialPrompt?: string): Promise<SystemDesignSessionDto> {
    const session = await this.prisma.systemDesignSession.upsert({
      where: { interviewId },
      update: {
        ...(initialPrompt ? { initialPrompt } : {}),
      },
      create: {
        interviewId,
        initialPrompt:
          initialPrompt ||
          'Design a High-Throughput Scalable URL Shortener service (like Bitly) handling 100M daily active users.',
      },
      include: {
        snapshots: {
          orderBy: { elapsedSeconds: 'asc' },
        },
        evaluation: true,
      },
    });

    return session as unknown as SystemDesignSessionDto;
  }

  /**
   * Save a canvas snapshot
   */
  async saveSnapshot(
    interviewId: string,
    imageUrl: string,
    canvasStateJson?: any,
    elapsedSeconds: number = 0
  ): Promise<CanvasSnapshotDto> {
    const session = await this.prisma.systemDesignSession.findUnique({
      where: { interviewId },
    });

    let currentSession = session;
    if (!currentSession) {
      currentSession = await this.prisma.systemDesignSession.create({
        data: { interviewId },
      });
    }

    const snapshot = await this.prisma.canvasSnapshot.create({
      data: {
        sessionId: currentSession.id,
        imageUrl,
        canvasStateJson: canvasStateJson || {},
        elapsedSeconds,
      },
    });

    // Update session final canvas URL
    await this.prisma.systemDesignSession.update({
      where: { id: currentSession.id },
      data: { finalCanvasUrl: imageUrl },
    });

    return snapshot as unknown as CanvasSnapshotDto;
  }

  /**
   * Get all snapshots for time-lapse replay
   */
  async getSnapshotHistory(interviewId: string): Promise<CanvasSnapshotDto[]> {
    const session = await this.prisma.systemDesignSession.findUnique({
      where: { interviewId },
      include: {
        snapshots: {
          orderBy: { elapsedSeconds: 'asc' },
        },
      },
    });

    if (!session) {
      return [];
    }

    return session.snapshots as unknown as CanvasSnapshotDto[];
  }

  /**
   * Get latest session info
   */
  async getSession(interviewId: string): Promise<SystemDesignSessionDto> {
    const session = await this.prisma.systemDesignSession.findUnique({
      where: { interviewId },
      include: {
        snapshots: {
          orderBy: { elapsedSeconds: 'asc' },
        },
        evaluation: true,
      },
    });

    if (!session) {
      throw new NotFoundException(`System design session for interview ${interviewId} not found`);
    }

    return session as unknown as SystemDesignSessionDto;
  }
}
