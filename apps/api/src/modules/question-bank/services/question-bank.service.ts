import { ConflictException, Injectable, Logger, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import {
  ErrorCode,
  AuditAction,
  QuestionPublicationStatus,
  QuestionAnswerAuthority,
  QuestionFeedbackStatus,
  QuestionBankQuestionDto,
  QuestionBankQuestionDetailDto,
  QuestionBankAnswerDto,
  RevealAnswerResponseDto,
  ReconciliationReportDto,
} from '@ai-interview/contracts';
import { QuestionBankEntitlementService } from './question-bank-entitlement.service';
import {
  EntitlementMetric,
  EntitlementReservationService,
} from '../../billing/entitlement-reservation.service';
import {
  QuestionBankQueryDto,
  CreateQuestionFeedbackDto,
  AdminCreateQuestionDto,
  AdminUpdateQuestionDto,
  AdminReviewQuestionDto,
} from '../dto/question-bank.dto';

@Injectable()
export class QuestionBankService {
  private readonly logger = new Logger(QuestionBankService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: QuestionBankEntitlementService,
    private readonly reservationService: EntitlementReservationService,
  ) {}

  /**
   * Helper to slugify a string safely.
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  }

  /**
   * Public / Authenticated question browsing with faceted filtering and pagination.
   * NEVER returns answerBody or rubric in the public projection.
   */
  async listQuestions(
    query: QuestionBankQueryDto,
    userId?: string,
  ): Promise<{ items: QuestionBankQuestionDto[]; meta: any }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.QuestionBankQuestionWhereInput = {
      status: QuestionPublicationStatus.PUBLISHED,
    };

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { questionBody: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (query.language) {
      where.language = query.language;
    }

    if (query.difficulty) {
      where.difficulty = Number(query.difficulty);
    }

    if (query.questionType) {
      where.questionType = query.questionType;
    }

    if (query.role) {
      where.jobRole = {
        OR: [{ id: query.role }, { slug: query.role }],
      };
    }

    if (query.seniority) {
      where.seniorityLevel = {
        OR: [{ id: query.seniority }, { slug: query.seniority }],
      };
    }

    if (query.technology) {
      where.technologies = {
        some: {
          technology: {
            OR: [{ id: query.technology }, { slug: query.technology }],
          },
        },
      };
    }

    const [total, questions] = await Promise.all([
      this.prisma.questionBankQuestion.count({ where }),
      this.prisma.questionBankQuestion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        include: {
          jobRole: true,
          seniorityLevel: true,
          technologies: {
            include: { technology: true },
          },
          answers: {
            where: { isPublished: true },
            select: { id: true, version: true },
          },
        },
      }),
    ]);

    // Check user bookmarks and revealed status if userId provided
    let userBookmarks = new Set<string>();
    let userGrants = new Set<string>();

    if (userId) {
      const entitlement = await this.entitlementService.getEffectiveEntitlement(userId);
      const questionIds = questions.map(q => q.id);

      const [bookmarks, grants] = await Promise.all([
        this.prisma.questionBookmark.findMany({
          where: {
            userId,
            questionId: { in: questionIds },
          },
          select: { questionId: true },
        }),
        this.prisma.questionAnswerAccessGrant.findMany({
          where: {
            userId,
            questionId: { in: questionIds },
            accessPeriodKey: entitlement.accessPeriodKey,
          },
          select: { questionId: true },
        }),
      ]);

      userBookmarks = new Set(bookmarks.map(b => b.questionId));
      userGrants = new Set(grants.map(g => g.questionId));
    }

    const items: QuestionBankQuestionDto[] = questions.map(q => {
      const activeAnswer = q.answers[0];
      return {
        id: q.id,
        slug: q.slug,
        title: q.title,
        questionBody: q.questionBody,
        questionType: q.questionType,
        difficulty: q.difficulty,
        language: q.language,
        status: q.status as any,
        minimumEntitlement: q.minimumEntitlement,
        currentAnswerId: q.currentAnswerId,
        currentAnswerVersion: activeAnswer?.version || null,
        publishedAt: q.publishedAt?.toISOString() || null,
        archivedAt: q.archivedAt?.toISOString() || null,
        createdById: q.createdById,
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
        jobRole: q.jobRole
          ? {
              id: q.jobRole.id,
              slug: q.jobRole.slug,
              name: q.jobRole.name,
              description: q.jobRole.description || null,
              isActive: q.jobRole.isActive,
            }
          : undefined,
        seniorityLevel: q.seniorityLevel
          ? {
              id: q.seniorityLevel.id,
              slug: q.seniorityLevel.slug,
              name: q.seniorityLevel.name,
              order: q.seniorityLevel.order,
              description: q.seniorityLevel.description || null,
              isActive: q.seniorityLevel.isActive,
            }
          : undefined,
        technologies: q.technologies.map(t => ({
          id: t.technology.id,
          slug: t.technology.slug,
          name: t.technology.name,
          category: t.technology.category || null,
          isActive: t.technology.isActive,
        })),
        isBookmarked: userBookmarks.has(q.id),
        isRevealed: userGrants.has(q.id),
        previewAvailable: true,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Safe question detail by slug.
   * If user already has an active access grant, full answer is included.
   * Otherwise, answerBody and rubric are omitted.
   */
  async getQuestionBySlug(slug: string, userId?: string): Promise<QuestionBankQuestionDetailDto> {
    const accessSnapshot = await this.prisma.$transaction(
      async tx => {
        const question = await tx.questionBankQuestion.findUnique({
          where: { slug },
          include: {
            jobRole: true,
            seniorityLevel: true,
            technologies: {
              include: { technology: true },
            },
            answers: {
              where: { isPublished: true },
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
        });

        if (!question || question.status !== QuestionPublicationStatus.PUBLISHED) {
          throw new DomainException(
            ErrorCode.QUESTION_BANK_NOT_FOUND,
            'Question not found or not published',
            HttpStatus.NOT_FOUND,
          );
        }

        const currentAnswer = question.answers[0];
        if (!userId || !currentAnswer) {
          return { question, currentAnswer, bookmark: null, grant: null };
        }

        // The entitlement period and exact grant must be read in the same
        // Serializable snapshot as the published answer. This is the final
        // answer-delivery authorization sink, not merely a preview check.
        const policy = await this.reservationService.getPolicyInTransaction(
          tx,
          userId,
          EntitlementMetric.QUESTION_BANK_ANSWER_REVEALS,
        );
        const [bookmark, grant] = await Promise.all([
          tx.questionBookmark.findUnique({
            where: {
              userId_questionId: {
                userId,
                questionId: question.id,
              },
            },
          }),
          tx.questionAnswerAccessGrant.findUnique({
            where: {
              userId_questionId_answerId_accessPeriodKey: {
                userId,
                questionId: question.id,
                answerId: currentAnswer.id,
                accessPeriodKey: policy.accessPeriodKey,
              },
            },
          }),
        ]);
        return { question, currentAnswer, bookmark, grant };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );

    const { question, currentAnswer } = accessSnapshot;
    const isBookmarked = !!accessSnapshot.bookmark;
    const revealedAnswer: QuestionBankAnswerDto | null = accessSnapshot.grant
      ? {
          id: currentAnswer!.id,
          questionId: currentAnswer!.questionId,
          version: currentAnswer!.version,
          authority: currentAnswer!.authority as any,
          answerBody: currentAnswer!.answerBody,
          explanationBody: currentAnswer!.explanationBody,
          rubric: currentAnswer!.rubric,
          commonMistakes: currentAnswer!.commonMistakes,
          sourceType: currentAnswer!.sourceType,
          reviewedById: currentAnswer!.reviewedById,
          reviewedAt: currentAnswer!.reviewedAt?.toISOString() || null,
          reviewNotes: currentAnswer!.reviewNotes,
          isPublished: currentAnswer!.isPublished,
          createdAt: currentAnswer!.createdAt.toISOString(),
        }
      : null;
    const revealedAt = accessSnapshot.grant?.grantedAt.toISOString() || null;

    // Related questions (same role or questionType, published)
    const related = await this.prisma.questionBankQuestion.findMany({
      where: {
        id: { not: question.id },
        status: QuestionPublicationStatus.PUBLISHED,
        OR: [{ jobRoleId: question.jobRoleId }, { questionType: question.questionType }],
      },
      take: 3,
      orderBy: { publishedAt: 'desc' },
      include: {
        jobRole: true,
        seniorityLevel: true,
        technologies: { include: { technology: true } },
      },
    });

    const relatedQuestions: QuestionBankQuestionDto[] = related.map(r => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      questionBody: r.questionBody,
      questionType: r.questionType,
      difficulty: r.difficulty,
      language: r.language,
      status: r.status as any,
      createdById: r.createdById,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      jobRole: r.jobRole
        ? {
            id: r.jobRole.id,
            slug: r.jobRole.slug,
            name: r.jobRole.name,
            description: r.jobRole.description || null,
            isActive: r.jobRole.isActive,
          }
        : undefined,
      seniorityLevel: r.seniorityLevel
        ? {
            id: r.seniorityLevel.id,
            slug: r.seniorityLevel.slug,
            name: r.seniorityLevel.name,
            order: r.seniorityLevel.order,
            description: r.seniorityLevel.description || null,
            isActive: r.seniorityLevel.isActive,
          }
        : undefined,
      technologies: r.technologies.map(t => ({
        id: t.technology.id,
        slug: t.technology.slug,
        name: t.technology.name,
        category: t.technology.category || null,
        isActive: t.technology.isActive,
      })),
    }));

    return {
      id: question.id,
      slug: question.slug,
      title: question.title,
      questionBody: question.questionBody,
      questionType: question.questionType,
      difficulty: question.difficulty,
      language: question.language,
      status: question.status as any,
      minimumEntitlement: question.minimumEntitlement,
      currentAnswerId: question.currentAnswerId,
      currentAnswerVersion: currentAnswer?.version || null,
      publishedAt: question.publishedAt?.toISOString() || null,
      archivedAt: question.archivedAt?.toISOString() || null,
      createdById: question.createdById,
      createdAt: question.createdAt.toISOString(),
      updatedAt: question.updatedAt.toISOString(),
      jobRole: question.jobRole
        ? {
            id: question.jobRole.id,
            slug: question.jobRole.slug,
            name: question.jobRole.name,
            description: question.jobRole.description || null,
            isActive: question.jobRole.isActive,
          }
        : undefined,
      seniorityLevel: question.seniorityLevel
        ? {
            id: question.seniorityLevel.id,
            slug: question.seniorityLevel.slug,
            name: question.seniorityLevel.name,
            order: question.seniorityLevel.order,
            description: question.seniorityLevel.description || null,
            isActive: question.seniorityLevel.isActive,
          }
        : undefined,
      technologies: question.technologies.map(t => ({
        id: t.technology.id,
        slug: t.technology.slug,
        name: t.technology.name,
        category: t.technology.category || null,
        isActive: t.technology.isActive,
      })),
      isBookmarked,
      isRevealed: !!revealedAnswer,
      previewAvailable: true,
      answer: revealedAnswer,
      revealedAt,
      disclaimer:
        'Đáp án tham khảo được biên soạn và kiểm duyệt, đi kèm tiêu chí đánh giá. Người học cần điều chỉnh theo bối cảnh, yêu cầu công việc và kinh nghiệm thực tế.',
      relatedQuestions,
    };
  }

  /**
   * Reveal full answer with quota check, idempotency and access ledger creation in a database transaction.
   */
  async revealAnswer(
    questionId: string,
    userId: string,
    idempotencyKey?: string,
  ): Promise<RevealAnswerResponseDto> {
    if (
      !idempotencyKey ||
      idempotencyKey.trim().length === 0 ||
      idempotencyKey.trim().length > 100
    ) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Idempotency-Key header is required for answer reveal',
        HttpStatus.BAD_REQUEST,
      );
    }

    const cleanIdempotencyKey = idempotencyKey.trim();

    const grantResult = await this.prisma.$transaction(
      async tx => {
        const question = await tx.questionBankQuestion.findUnique({
          where: { id: questionId },
          include: {
            answers: {
              where: { isPublished: true },
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
        });
        if (!question || question.status !== QuestionPublicationStatus.PUBLISHED) {
          throw new DomainException(
            ErrorCode.QUESTION_BANK_NOT_FOUND,
            'Question not found or not published',
            HttpStatus.NOT_FOUND,
          );
        }
        const activeAnswer = question.answers[0];
        if (!activeAnswer) {
          throw new DomainException(
            ErrorCode.QUESTION_BANK_ANSWER_UNAVAILABLE,
            'Answer is currently unavailable for this question',
            HttpStatus.CONFLICT,
          );
        }

        const entitlementPolicy = await this.reservationService.getPolicyInTransaction(
          tx,
          userId,
          EntitlementMetric.QUESTION_BANK_ANSWER_REVEALS,
        );
        const existingGrant = await tx.questionAnswerAccessGrant.findUnique({
          where: {
            userId_questionId_answerId_accessPeriodKey: {
              userId,
              questionId: question.id,
              answerId: activeAnswer.id,
              accessPeriodKey: entitlementPolicy.accessPeriodKey,
            },
          },
        });
        if (existingGrant) {
          return { isReplay: true, activeAnswer };
        }

        const reservation = await this.reservationService.reserveInTransaction(tx, {
          userId,
          metric: EntitlementMetric.QUESTION_BANK_ANSWER_REVEALS,
          quantity: 1,
          idempotencyKey: cleanIdempotencyKey,
          operationType: 'question-bank.answer-reveal',
          operationId: `${question.id}:${activeAnswer.id}`,
        });
        if (reservation.isNewReservation !== true) {
          throw new ConflictException(
            'This reveal operation has already been processed or is awaiting reconciliation.',
          );
        }
        if (reservation.state === 'COMMITTED') {
          throw new ConflictException('A committed reveal reservation is missing its access grant');
        }
        if (reservation.state !== 'RESERVED') {
          throw new ConflictException(
            'The reveal operation is awaiting entitlement reconciliation',
          );
        }

        const grant = await tx.questionAnswerAccessGrant.create({
          data: {
            userId,
            questionId: question.id,
            answerId: activeAnswer.id,
            accessPeriodKey: reservation.accessPeriodKey,
            idempotencyKey: cleanIdempotencyKey,
            entitlementKey: EntitlementMetric.QUESTION_BANK_ANSWER_REVEALS,
            policyVersion: 'v2-atomic-reservation',
          },
        });
        await tx.questionBankUsageLedger.create({
          data: {
            userId,
            entitlementKey: EntitlementMetric.QUESTION_BANK_ANSWER_REVEALS,
            accessPeriodKey: reservation.accessPeriodKey,
            quantity: 1,
            grantId: grant.id,
          },
        });
        await this.reservationService.commitInTransaction(tx, {
          reservationId: reservation.id,
          actualQuantity: 1,
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: AuditAction.QUESTION_BANK_ANSWER_REVEALED,
            resource: 'question-bank',
            resourceId: question.id,
            details: {
              questionId: question.id,
              answerId: activeAnswer.id,
              version: activeAnswer.version,
              accessPeriodKey: reservation.accessPeriodKey,
              idempotencyKey: cleanIdempotencyKey,
              reservationId: reservation.id,
            },
          },
        });
        return { isReplay: false, activeAnswer };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );

    const entitlement = await this.entitlementService.getEffectiveEntitlement(userId);
    const answerDto: QuestionBankAnswerDto = {
      id: grantResult.activeAnswer.id,
      questionId: grantResult.activeAnswer.questionId,
      version: grantResult.activeAnswer.version,
      authority: grantResult.activeAnswer.authority as any,
      answerBody: grantResult.activeAnswer.answerBody,
      explanationBody: grantResult.activeAnswer.explanationBody,
      rubric: grantResult.activeAnswer.rubric,
      commonMistakes: grantResult.activeAnswer.commonMistakes,
      sourceType: grantResult.activeAnswer.sourceType,
      reviewedById: grantResult.activeAnswer.reviewedById,
      reviewedAt: grantResult.activeAnswer.reviewedAt?.toISOString() || null,
      reviewNotes: grantResult.activeAnswer.reviewNotes,
      isPublished: grantResult.activeAnswer.isPublished,
      createdAt: grantResult.activeAnswer.createdAt.toISOString(),
    };

    return {
      data: answerDto,
      meta: {
        access: grantResult.isReplay ? 'existing_grant' : 'new_grant',
        quota: {
          limit: entitlement.revealsLimit,
          used: entitlement.revealsUsed,
          remaining: entitlement.revealsRemaining,
          resetsAt: entitlement.periodResetsAt,
        },
      },
    };
  }

  /**
   * Bookmark operations
   */
  async addBookmark(questionId: string, userId: string): Promise<{ success: boolean }> {
    const question = await this.prisma.questionBankQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question || question.status !== QuestionPublicationStatus.PUBLISHED) {
      throw new DomainException(
        ErrorCode.QUESTION_BANK_NOT_FOUND,
        'Question not found',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.questionBookmark.upsert({
      where: {
        userId_questionId: {
          userId,
          questionId,
        },
      },
      create: {
        userId,
        questionId,
      },
      update: {},
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.QUESTION_BANK_BOOKMARK_ADDED,
        resource: 'question-bank',
        resourceId: questionId,
        details: { questionId },
      },
    });

    return { success: true };
  }

  async removeBookmark(questionId: string, userId: string): Promise<{ success: boolean }> {
    await this.prisma.questionBookmark.deleteMany({
      where: {
        userId,
        questionId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.QUESTION_BANK_BOOKMARK_REMOVED,
        resource: 'question-bank',
        resourceId: questionId,
        details: { questionId },
      },
    });

    return { success: true };
  }

  async listBookmarks(
    userId: string,
    query: QuestionBankQueryDto,
  ): Promise<{ items: QuestionBankQuestionDto[]; meta: any }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const [total, bookmarks] = await Promise.all([
      this.prisma.questionBookmark.count({ where: { userId } }),
      this.prisma.questionBookmark.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          question: {
            include: {
              jobRole: true,
              seniorityLevel: true,
              technologies: { include: { technology: true } },
            },
          },
        },
      }),
    ]);

    const entitlement = await this.entitlementService.getEffectiveEntitlement(userId);
    const questionIds = bookmarks.map(b => b.questionId);

    const grants = await this.prisma.questionAnswerAccessGrant.findMany({
      where: {
        userId,
        questionId: { in: questionIds },
        accessPeriodKey: entitlement.accessPeriodKey,
      },
      select: { questionId: true },
    });

    const userGrants = new Set(grants.map(g => g.questionId));

    const items: QuestionBankQuestionDto[] = bookmarks.map(b => {
      const q = b.question;
      return {
        id: q.id,
        slug: q.slug,
        title: q.title,
        questionBody: q.questionBody,
        questionType: q.questionType,
        difficulty: q.difficulty,
        language: q.language,
        status: q.status as any,
        minimumEntitlement: q.minimumEntitlement,
        createdById: q.createdById,
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
        jobRole: q.jobRole
          ? {
              id: q.jobRole.id,
              slug: q.jobRole.slug,
              name: q.jobRole.name,
              description: q.jobRole.description || null,
              isActive: q.jobRole.isActive,
            }
          : undefined,
        seniorityLevel: q.seniorityLevel
          ? {
              id: q.seniorityLevel.id,
              slug: q.seniorityLevel.slug,
              name: q.seniorityLevel.name,
              order: q.seniorityLevel.order,
              description: q.seniorityLevel.description || null,
              isActive: q.seniorityLevel.isActive,
            }
          : undefined,
        technologies: q.technologies.map(t => ({
          id: t.technology.id,
          slug: t.technology.slug,
          name: t.technology.name,
          category: t.technology.category || null,
          isActive: t.technology.isActive,
        })),
        isBookmarked: true,
        isRevealed: userGrants.has(q.id),
        previewAvailable: true,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Submit content feedback / error report
   */
  async submitFeedback(
    questionId: string,
    userId: string,
    dto: CreateQuestionFeedbackDto,
  ): Promise<{ id: string; success: boolean }> {
    const question = await this.prisma.questionBankQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new DomainException(
        ErrorCode.QUESTION_BANK_NOT_FOUND,
        'Question not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const feedback = await this.prisma.questionFeedback.create({
      data: {
        userId,
        questionId,
        reason: dto.reason,
        details: dto.details,
        status: QuestionFeedbackStatus.PENDING,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.QUESTION_BANK_FEEDBACK_SUBMITTED,
        resource: 'question-bank',
        resourceId: questionId,
        details: {
          questionId,
          feedbackId: feedback.id,
          reason: dto.reason,
        },
      },
    });

    return { id: feedback.id, success: true };
  }

  // ==========================================
  // ADMIN & CONTENT GOVERNANCE WORKFLOW
  // ==========================================

  async adminListQuestions(query: any): Promise<{ items: any[]; meta: any }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.QuestionBankQuestionWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { questionBody: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, questions] = await Promise.all([
      this.prisma.questionBankQuestion.count({ where }),
      this.prisma.questionBankQuestion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          jobRole: true,
          seniorityLevel: true,
          createdBy: { select: { id: true, email: true } },
          answers: { orderBy: { version: 'desc' } },
          _count: { select: { feedbacks: true, accessGrants: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: questions,
      meta: { total, page, limit, totalPages },
    };
  }

  async adminGetQuestion(id: string): Promise<any> {
    const question = await this.prisma.questionBankQuestion.findUnique({
      where: { id },
      include: {
        jobRole: true,
        seniorityLevel: true,
        technologies: { include: { technology: true } },
        createdBy: { select: { id: true, email: true } },
        answers: {
          orderBy: { version: 'desc' },
          include: { reviewedBy: { select: { id: true, email: true } } },
        },
        feedbacks: {
          include: { user: { select: { id: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!question) {
      throw new DomainException(
        ErrorCode.QUESTION_BANK_NOT_FOUND,
        'Question not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return question;
  }

  async adminCreateQuestion(dto: AdminCreateQuestionDto, authorId: string): Promise<any> {
    const baseSlug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.title);
    let finalSlug = baseSlug;

    // Check slug uniqueness
    const existing = await this.prisma.questionBankQuestion.findUnique({
      where: { slug: finalSlug },
    });
    if (existing) {
      finalSlug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    const question = await this.prisma.$transaction(async tx => {
      const q = await tx.questionBankQuestion.create({
        data: {
          slug: finalSlug,
          title: dto.title,
          questionBody: dto.questionBody,
          questionType: dto.questionType,
          difficulty: dto.difficulty || 3,
          language: dto.language || 'vi',
          status: QuestionPublicationStatus.PUBLISHED,
          publishedAt: new Date(),
          minimumEntitlement: dto.minimumEntitlement,
          createdById: authorId,
          jobRoleId: dto.jobRoleId,
          seniorityLevelId: dto.seniorityLevelId,
        },
      });

      // Create initial answer (v1)
      const answer = await tx.questionBankAnswer.create({
        data: {
          questionId: q.id,
          version: 1,
          authority: (dto.initialAnswer?.authority as any) || QuestionAnswerAuthority.REFERENCE,
          answerBody: dto.initialAnswer?.answerBody || '',
          explanationBody: dto.initialAnswer?.explanationBody,
          rubric: dto.initialAnswer?.rubric || Prisma.DbNull,
          commonMistakes: dto.initialAnswer?.commonMistakes || Prisma.DbNull,
          sourceType: dto.initialAnswer?.sourceType || 'curated',
          isPublished: true,
        },
      });

      // Link technologies
      if (dto.technologyIds && dto.technologyIds.length > 0) {
        await tx.questionBankTechnology.createMany({
          data: dto.technologyIds.map(techId => ({
            questionId: q.id,
            technologyId: techId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.auditLog.create({
        data: {
          userId: authorId,
          action: AuditAction.QUESTION_BANK_QUESTION_CREATED,
          resource: 'question-bank',
          resourceId: q.id,
          details: { questionId: q.id, slug: finalSlug, answerId: answer.id },
        },
      });

      return tx.questionBankQuestion.update({
        where: { id: q.id },
        data: { currentAnswerId: answer.id },
      });
    });

    return question;
  }

  async adminUpdateQuestion(
    id: string,
    dto: AdminUpdateQuestionDto,
    editorId: string,
  ): Promise<any> {
    const question = await this.prisma.questionBankQuestion.findUnique({
      where: { id },
      include: {
        answers: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!question) {
      throw new DomainException(
        ErrorCode.QUESTION_BANK_NOT_FOUND,
        'Question not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await this.prisma.$transaction(async tx => {
      // If question is not published/archived, update directly
      const q = await tx.questionBankQuestion.update({
        where: { id },
        data: {
          title: dto.title,
          slug: dto.slug ? this.slugify(dto.slug) : undefined,
          questionBody: dto.questionBody,
          questionType: dto.questionType,
          difficulty: dto.difficulty,
          language: dto.language,
          jobRoleId: dto.jobRoleId,
          seniorityLevelId: dto.seniorityLevelId,
          minimumEntitlement: dto.minimumEntitlement,
        },
      });

      // Update technologies if specified
      if (dto.technologyIds) {
        await tx.questionBankTechnology.deleteMany({ where: { questionId: id } });
        if (dto.technologyIds.length > 0) {
          await tx.questionBankTechnology.createMany({
            data: dto.technologyIds.map(techId => ({
              questionId: id,
              technologyId: techId,
            })),
            skipDuplicates: true,
          });
        }
      }

      // If answer body or metadata updated
      if (
        dto.answerBody ||
        dto.authority ||
        dto.explanationBody ||
        dto.rubric ||
        dto.commonMistakes
      ) {
        const latestAnswer = question.answers[0];

        if (question.status === QuestionPublicationStatus.DRAFT && latestAnswer) {
          // Update draft answer in-place
          await tx.questionBankAnswer.update({
            where: { id: latestAnswer.id },
            data: {
              authority: dto.authority as any,
              answerBody: dto.answerBody,
              explanationBody: dto.explanationBody,
              rubric: dto.rubric !== undefined ? dto.rubric : undefined,
              commonMistakes: dto.commonMistakes !== undefined ? dto.commonMistakes : undefined,
              sourceType: dto.sourceType,
            },
          });
        } else {
          // Create new revision version
          const nextVersion = (latestAnswer?.version || 0) + 1;
          await tx.questionBankAnswer.create({
            data: {
              questionId: id,
              version: nextVersion,
              authority:
                (dto.authority as any) ||
                latestAnswer?.authority ||
                QuestionAnswerAuthority.REFERENCE,
              answerBody: dto.answerBody || latestAnswer?.answerBody || '',
              explanationBody:
                dto.explanationBody !== undefined
                  ? dto.explanationBody
                  : latestAnswer?.explanationBody,
              rubric: dto.rubric !== undefined ? dto.rubric : latestAnswer?.rubric || Prisma.DbNull,
              commonMistakes:
                dto.commonMistakes !== undefined
                  ? dto.commonMistakes
                  : latestAnswer?.commonMistakes || Prisma.DbNull,
              sourceType: dto.sourceType || latestAnswer?.sourceType || 'curated',
              isPublished: false,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: editorId,
          action: AuditAction.QUESTION_BANK_QUESTION_UPDATED,
          resource: 'question-bank',
          resourceId: id,
          details: { questionId: id },
        },
      });

      return q;
    });

    return updated;
  }

  async adminSubmitReview(id: string, submitterId: string): Promise<any> {
    const question = await this.prisma.questionBankQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      throw new DomainException(
        ErrorCode.QUESTION_BANK_NOT_FOUND,
        'Question not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (question.status !== QuestionPublicationStatus.DRAFT) {
      throw new DomainException(
        ErrorCode.QUESTION_BANK_INVALID_TRANSITION,
        `Cannot submit for review from state [${question.status}]`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.questionBankQuestion.update({
      where: { id },
      data: { status: QuestionPublicationStatus.IN_REVIEW },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: submitterId,
        action: AuditAction.QUESTION_BANK_QUESTION_SUBMITTED_REVIEW,
        resource: 'question-bank',
        resourceId: id,
        details: { questionId: id },
      },
    });

    return updated;
  }

  async adminReview(id: string, dto: AdminReviewQuestionDto, reviewerId: string): Promise<any> {
    const question = await this.prisma.questionBankQuestion.findUnique({
      where: { id },
      include: {
        answers: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!question) {
      throw new DomainException(
        ErrorCode.QUESTION_BANK_NOT_FOUND,
        'Question not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (question.status !== QuestionPublicationStatus.IN_REVIEW) {
      throw new DomainException(
        ErrorCode.QUESTION_BANK_INVALID_TRANSITION,
        `Question must be IN_REVIEW to be reviewed. Current state: [${question.status}]`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Content Governance: Reviewer MUST NOT be the author
    if (reviewerId === question.createdById) {
      throw new DomainException(
        ErrorCode.QUESTION_BANK_REVIEWER_EQUALS_AUTHOR,
        'Reviewer cannot be the author of the question',
        HttpStatus.FORBIDDEN,
      );
    }

    const latestAnswer = question.answers[0];
    if (!latestAnswer) {
      throw new DomainException(
        ErrorCode.QUESTION_BANK_ANSWER_UNAVAILABLE,
        'No answer available to review',
        HttpStatus.BAD_REQUEST,
      );
    }

    const nextStatus =
      dto.action === 'APPROVE'
        ? QuestionPublicationStatus.APPROVED
        : QuestionPublicationStatus.DRAFT;

    const result = await this.prisma.$transaction(async tx => {
      const q = await tx.questionBankQuestion.update({
        where: { id },
        data: { status: nextStatus },
      });

      if (dto.action === 'APPROVE') {
        await tx.questionBankAnswer.update({
          where: { id: latestAnswer.id },
          data: {
            reviewedById: reviewerId,
            reviewedAt: new Date(),
            reviewNotes: dto.reviewNotes,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: AuditAction.QUESTION_BANK_QUESTION_REVIEWED,
          resource: 'question-bank',
          resourceId: id,
          details: {
            questionId: id,
            action: dto.action,
            notes: dto.reviewNotes,
            answerId: latestAnswer.id,
          },
        },
      });

      return q;
    });

    return result;
  }

  async adminPublish(id: string, publisherId: string): Promise<any> {
    const question = await this.prisma.questionBankQuestion.findUnique({
      where: { id },
      include: {
        answers: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!question) {
      throw new DomainException(
        ErrorCode.QUESTION_BANK_NOT_FOUND,
        'Question not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (question.status !== QuestionPublicationStatus.APPROVED) {
      throw new DomainException(
        ErrorCode.CONTENT_NOT_REVIEWED,
        `Question must be in APPROVED status before publishing. Current status: [${question.status}]`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const latestAnswer = question.answers[0];
    if (!latestAnswer) {
      throw new DomainException(
        ErrorCode.QUESTION_BANK_ANSWER_UNAVAILABLE,
        'Cannot publish question without an approved answer',
        HttpStatus.BAD_REQUEST,
      );
    }

    const published = await this.prisma.$transaction(async tx => {
      // Mark answer as published
      await tx.questionBankAnswer.update({
        where: { id: latestAnswer.id },
        data: { isPublished: true },
      });

      // Update question status to PUBLISHED
      const q = await tx.questionBankQuestion.update({
        where: { id },
        data: {
          status: QuestionPublicationStatus.PUBLISHED,
          currentAnswerId: latestAnswer.id,
          publishedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: publisherId,
          action: AuditAction.QUESTION_BANK_QUESTION_PUBLISHED,
          resource: 'question-bank',
          resourceId: id,
          details: { questionId: id, answerId: latestAnswer.id, version: latestAnswer.version },
        },
      });

      return q;
    });

    return published;
  }

  async adminArchive(id: string, archiverId: string): Promise<any> {
    const question = await this.prisma.questionBankQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      throw new DomainException(
        ErrorCode.QUESTION_BANK_NOT_FOUND,
        'Question not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (question.status !== QuestionPublicationStatus.PUBLISHED) {
      throw new DomainException(
        ErrorCode.QUESTION_BANK_INVALID_TRANSITION,
        `Only PUBLISHED questions can be archived. Current status: [${question.status}]`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const archived = await this.prisma.questionBankQuestion.update({
      where: { id },
      data: {
        status: QuestionPublicationStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: archiverId,
        action: AuditAction.QUESTION_BANK_QUESTION_ARCHIVED,
        resource: 'question-bank',
        resourceId: id,
        details: { questionId: id },
      },
    });

    return archived;
  }

  /**
   * Run reconciliation check between QuestionAnswerAccessGrant and QuestionBankUsageLedger.
   */
  async adminReconciliation(): Promise<ReconciliationReportDto> {
    const [grants, usageRecords] = await Promise.all([
      this.prisma.questionAnswerAccessGrant.findMany({
        select: { id: true, userId: true },
      }),
      this.prisma.questionBankUsageLedger.findMany({
        select: { id: true, grantId: true, userId: true },
      }),
    ]);

    const grantMap = new Set(grants.map(g => g.id));
    const usageGrantMap = new Set(usageRecords.map(u => u.grantId));

    const orphanedGrants = grants.filter(g => !usageGrantMap.has(g.id)).map(g => g.id);
    const orphanedUsageRecords = usageRecords.filter(u => !grantMap.has(u.grantId)).map(u => u.id);

    const isHealthy = orphanedGrants.length === 0 && orphanedUsageRecords.length === 0;

    return {
      checkedAt: new Date().toISOString(),
      totalGrants: grants.length,
      totalUsageRecords: usageRecords.length,
      orphanedGrants,
      orphanedUsageRecords,
      isHealthy,
    };
  }
}
