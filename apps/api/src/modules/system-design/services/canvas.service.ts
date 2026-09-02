import { Injectable, NotFoundException, ForbiddenException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { SystemDesignSessionDto, CanvasSnapshotDto, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import * as crypto from 'crypto';

export interface ExportCanvasResult {
  interviewId: string;
  version: number;
  etag: string;
  finalCanvasUrl: string | null;
  initialPrompt: string | null;
  snapshotCount: number;
  nodesCount: number;
  connectorsCount: number;
  exportedAt: string;
  format: string;
  svgContent?: string;
  canvasState?: Record<string, any>;
}

@Injectable()
export class CanvasService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifySessionOwnership(userId: string, interviewId: string) {
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
    });
    if (!interview) {
      throw new NotFoundException(`Interview session ${interviewId} not found`);
    }
    if (interview.userId !== userId) {
      throw new ForbiddenException('Access to this system design session is forbidden');
    }
    return interview;
  }

  private generateEtag(version: number, canvasState: any): string {
    const stateStr = JSON.stringify(canvasState || {});
    const hash = crypto
      .createHash('sha256')
      .update(`${version}:${stateStr}`)
      .digest('hex')
      .substring(0, 16);
    return `W/"v${version}-${hash}"`;
  }

  /**
   * Initialize a system design whiteboard session
   */
  async initSession(
    userId: string,
    interviewId: string,
    initialPrompt?: string,
  ): Promise<SystemDesignSessionDto> {
    await this.verifySessionOwnership(userId, interviewId);

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
   * Save a canvas snapshot with optimistic concurrency & ETag conflict check
   */
  async saveSnapshot(
    userId: string,
    interviewId: string,
    imageUrl: string,
    canvasStateJson?: any,
    elapsedSeconds: number = 0,
    expectedVersion?: number,
    ifMatchEtag?: string,
  ): Promise<CanvasSnapshotDto & { version: number; etag: string }> {
    await this.verifySessionOwnership(userId, interviewId);

    const MAX_RETRIES = 3;
    let result: (CanvasSnapshotDto & { version: number; etag: string }) | null = null;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const runTx =
          typeof this.prisma.$transaction === 'function'
            ? (fn: (tx: any) => Promise<any>) =>
                this.prisma.$transaction(fn, {
                  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
                  timeout: 10000,
                })
            : async (fn: (tx: any) => Promise<any>) => fn(this.prisma);

        result = await runTx(async tx => {
          let currentSession = await tx.systemDesignSession.findUnique({
            where: { interviewId },
            include: {
              snapshots: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          });

          if (!currentSession) {
            currentSession = await tx.systemDesignSession.create({
              data: { interviewId },
              include: {
                snapshots: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            });
          }

          let latestSnapshot: any = currentSession.snapshots?.[0];
          if (!latestSnapshot && typeof tx.canvasSnapshot?.findFirst === 'function') {
            latestSnapshot = await tx.canvasSnapshot.findFirst({
              where: { sessionId: currentSession.id },
              orderBy: { createdAt: 'desc' },
            });
          }

          const latestState = (latestSnapshot?.canvasStateJson as any) || {};
          const currentVersion = latestState.version || 0;
          const currentEtag = latestState.etag || this.generateEtag(currentVersion, latestState);

          // Optimistic Concurrency Control (Version / ETag check)
          if (
            expectedVersion !== undefined &&
            expectedVersion !== currentVersion &&
            !(currentVersion === 0 && expectedVersion <= 1)
          ) {
            throw new DomainException(
              ErrorCode.IDEMPOTENCY_CONFLICT,
              `Diagram version conflict: expected version ${expectedVersion} but current version is ${currentVersion}`,
              HttpStatus.CONFLICT,
            );
          }

          if (ifMatchEtag && ifMatchEtag !== currentEtag && currentVersion > 0) {
            throw new DomainException(
              ErrorCode.IDEMPOTENCY_CONFLICT,
              `Diagram ETag conflict: provided ETag ${ifMatchEtag} does not match current ETag ${currentEtag}`,
              HttpStatus.CONFLICT,
            );
          }

          const nextVersion = currentVersion + 1;
          const nextEtag = this.generateEtag(nextVersion, canvasStateJson);

          // Normalize architecture nodes and connection metadata
          const stateToSave = {
            ...(canvasStateJson || {}),
            version: nextVersion,
            etag: nextEtag,
            elements: (canvasStateJson?.elements || []).map((el: any) => ({
              id: el.id,
              type: el.type,
              label: el.label,
              x: typeof el.x === 'number' ? el.x : 0,
              y: typeof el.y === 'number' ? el.y : 0,
              width: typeof el.width === 'number' ? el.width : 140,
              height: typeof el.height === 'number' ? el.height : 60,
              color: el.color || '#4f46e5',
              properties: el.properties || {},
            })),
            connectors: (canvasStateJson?.connectors || []).map((conn: any) => ({
              id: conn.id,
              fromId: conn.fromId,
              toId: conn.toId,
              protocol: conn.protocol || 'HTTP/REST',
              label: conn.label || '',
              properties: conn.properties || {},
            })),
          };

          const snapshot = await tx.canvasSnapshot.create({
            data: {
              sessionId: currentSession.id,
              imageUrl,
              canvasStateJson: stateToSave,
              elapsedSeconds,
            },
          });

          // Update session final canvas URL
          await tx.systemDesignSession.update({
            where: { id: currentSession.id },
            data: { finalCanvasUrl: imageUrl },
          });

          return {
            ...(snapshot as unknown as CanvasSnapshotDto),
            version: nextVersion,
            etag: nextEtag,
          };
        });
        break;
      } catch (err: any) {
        lastError = err;
        if (err?.code === 'P2034' && attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 20 * attempt));
          continue;
        }
        throw err;
      }
    }

    if (!result) {
      throw (
        lastError || new DomainException(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to save snapshot')
      );
    }

    return result;
  }

  /**
   * Get all snapshots for time-lapse replay
   */
  async getSnapshotHistory(userId: string, interviewId: string): Promise<CanvasSnapshotDto[]> {
    await this.verifySessionOwnership(userId, interviewId);

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
  async getSession(userId: string, interviewId: string): Promise<SystemDesignSessionDto> {
    await this.verifySessionOwnership(userId, interviewId);

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

  /**
   * Export diagram with version, etag, and rendered SVG
   */
  async exportDiagram(
    userId: string,
    interviewId: string,
    format: 'svg' | 'png' | 'json' = 'svg',
  ): Promise<ExportCanvasResult> {
    await this.verifySessionOwnership(userId, interviewId);

    const session = await this.prisma.systemDesignSession.findUnique({
      where: { interviewId },
      include: {
        snapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`System design session for interview ${interviewId} not found`);
    }

    const latestSnapshot = session.snapshots?.[0];
    const canvasState = (latestSnapshot?.canvasStateJson as any) || {
      elements: [],
      connectors: [],
    };
    const version = canvasState.version || session.snapshots?.length || 1;
    const etag = canvasState.etag || this.generateEtag(version, canvasState);
    const elements = canvasState.elements || [];
    const connectors = canvasState.connectors || [];

    // Generate comprehensive SVG representation
    const svgElements = elements
      .map(
        (el: any) =>
          `<g id="${el.id}" transform="translate(${el.x},${el.y})">` +
          `<rect width="${el.width || 140}" height="${el.height || 60}" rx="8" fill="${el.color || '#4f46e5'}" stroke="#0f172a" stroke-width="1.5" />` +
          `<text x="${(el.width || 140) / 2}" y="${(el.height || 60) / 2 - 4}" text-anchor="middle" fill="#ffffff" font-size="12" font-family="system-ui, sans-serif" font-weight="700">${(el.label || el.type || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>` +
          `<text x="${(el.width || 140) / 2}" y="${(el.height || 60) / 2 + 14}" text-anchor="middle" fill="#e2e8f0" font-size="10" font-family="system-ui, sans-serif">${(el.type || '').replace(/_/g, ' ')}</text>` +
          `</g>`,
      )
      .join('');

    const svgConnectors = connectors
      .map((conn: any) => {
        const fromEl = elements.find((e: any) => e.id === conn.fromId);
        const toEl = elements.find((e: any) => e.id === conn.toId);
        if (!fromEl || !toEl) return '';
        const x1 = (fromEl.x || 0) + (fromEl.width || 140) / 2;
        const y1 = (fromEl.y || 0) + (fromEl.height || 60) / 2;
        const x2 = (toEl.x || 0) + (toEl.width || 140) / 2;
        const y2 = (toEl.y || 0) + (toEl.height || 60) / 2;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        return (
          `<g id="${conn.id}">` +
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#64748b" stroke-width="2" stroke-dasharray="4,4" marker-end="url(#arrowhead)" />` +
          (conn.protocol || conn.label
            ? `<rect x="${midX - 35}" y="${midY - 10}" width="70" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />` +
              `<text x="${midX}" y="${midY + 3}" text-anchor="middle" fill="#334155" font-size="9" font-family="system-ui, sans-serif" font-weight="600">${(conn.label || conn.protocol).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`
            : '') +
          `</g>`
        );
      })
      .join('');

    const svgContent =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">` +
      `<defs>` +
      `<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">` +
      `<polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />` +
      `</marker>` +
      `<pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">` +
      `<path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" stroke-width="1"/>` +
      `</pattern>` +
      `</defs>` +
      `<rect width="100%" height="100%" fill="#ffffff" />` +
      `<rect width="100%" height="100%" fill="url(#grid)" />` +
      `<g id="connectors">${svgConnectors}</g>` +
      `<g id="elements">${svgElements}</g>` +
      `</svg>`;

    return {
      interviewId,
      version,
      etag,
      finalCanvasUrl: session.finalCanvasUrl,
      initialPrompt: session.initialPrompt,
      snapshotCount: session.snapshots?.length || 0,
      nodesCount: elements.length,
      connectorsCount: connectors.length,
      exportedAt: new Date().toISOString(),
      format,
      svgContent: format === 'svg' ? svgContent : undefined,
      canvasState: format === 'json' ? canvasState : undefined,
    };
  }
}
