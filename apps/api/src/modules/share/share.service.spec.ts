import { Test, TestingModule } from '@nestjs/testing';
import { ShareService } from './share.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { SessionState, ShareExpiryDuration, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import * as bcrypt from 'bcrypt';

describe('ShareService', () => {
  let service: ShareService;
  let prisma: any;

  const mockUserId = 'user-123';
  const mockSessionId = 'session-456';

  beforeEach(async () => {
    prisma = {
      interviewSession: {
        findUnique: jest.fn(),
      },
      shareToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      mentorFeedback: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ShareService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ShareService>(ShareService);
  });

  it('should create a share token for a completed session', async () => {
    prisma.interviewSession.findUnique.mockResolvedValue({
      id: mockSessionId,
      userId: mockUserId,
      state: SessionState.COMPLETED,
    });

    prisma.shareToken.create.mockResolvedValue({
      id: 'token-id-1',
      sessionId: mockSessionId,
      token: 'crypto-token-hex',
      isRevoked: false,
      isAnonymized: true,
      expiresAt: new Date(Date.now() + 7 * 86400000),
      viewCount: 0,
      lastViewedAt: null,
      createdAt: new Date(),
      mentorFeedback: [],
    });

    const result = await service.createShareToken(mockUserId, mockSessionId, {
      expiry: ShareExpiryDuration.SEVEN_DAYS,
      isAnonymized: true,
    });

    expect(result.token).toBe('crypto-token-hex');
    expect(result.isAnonymized).toBe(true);
    expect(result.shareUrl).toBe('/share/crypto-token-hex');
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('should reject creating share link for active or non-completed session', async () => {
    prisma.interviewSession.findUnique.mockResolvedValue({
      id: mockSessionId,
      userId: mockUserId,
      state: SessionState.ACTIVE,
    });

    await expect(
      service.createShareToken(mockUserId, mockSessionId, {
        expiry: ShareExpiryDuration.ONE_DAY,
      }),
    ).rejects.toThrow(DomainException);
  });

  it('should return public shared result with candidate anonymized', async () => {
    prisma.shareToken.findUnique.mockResolvedValue({
      id: 'token-id-1',
      token: 'valid-token',
      isRevoked: false,
      isAnonymized: true,
      expiresAt: new Date(Date.now() + 86400000),
      viewCount: 2,
      createdAt: new Date(),
      mentorFeedback: [],
      session: {
        id: mockSessionId,
        state: SessionState.COMPLETED,
        overallScore: 8.5,
        completedAt: new Date(),
        jobRole: { name: 'Full-Stack Engineer' },
        seniorityLevel: { name: 'Mid-Level' },
        technologies: [{ technology: { name: 'TypeScript' } }],
        user: {
          email: 'secret@candidate.com',
          profile: { fullName: 'Secret Candidate' },
        },
        turns: [
          {
            turnNumber: 1,
            difficulty: 2,
            status: 'COMPLETED',
            question: { content: 'Explain Node.js event loop.', keyFocus: 'Event Loop' },
            answer: {
              content: 'The event loop processes microtasks then macrotasks.',
              submittedAt: new Date(),
              evaluation: {
                score: 8.5,
                rubricScores: { technicalAccuracy: 9, depth: 8, clarity: 8.5 },
                strengths: ['Clear terminology'],
                improvements: ['Mention setImmediate vs process.nextTick'],
                conciseFeedback: 'Solid explanation.',
                evidence: 'Accurate distinction between phases.',
              },
            },
          },
        ],
        learningPath: null,
      },
    });

    prisma.shareToken.update.mockResolvedValue({});

    const result = await service.getPublicSharedResult('valid-token');
    expect(result.candidate.fullName).toBe('Anonymous Candidate');
    expect((result.candidate as any).email).toBeUndefined();
    expect(result.session.overallScore).toBeNull();
    expect(result.session.rubricAverages.technicalAccuracy).toBe(0);
  });

  it('should reject expired share link', async () => {
    prisma.shareToken.findUnique.mockResolvedValue({
      id: 'token-id-1',
      token: 'expired-token',
      isRevoked: false,
      expiresAt: new Date(Date.now() - 10000), // in the past
    });

    await expect(service.getPublicSharedResult('expired-token')).rejects.toThrow(DomainException);
  });

  it('uses authoritative evaluations for the public overall score', async () => {
    const makeTurn = (turnNumber: number, score: number, authorityState: string) => ({
      turnNumber,
      difficulty: 2,
      status: 'EVALUATED',
      question: { content: `Question ${turnNumber}`, keyFocus: 'Focus' },
      answer: {
        content: `Answer ${turnNumber}`,
        submittedAt: new Date(),
        evaluation: {
          score,
          authorityState,
          needsReview: authorityState !== 'AUTHORITATIVE',
          provider: authorityState === 'AUTHORITATIVE' ? 'openai' : 'mock',
          rubricScores: { technicalAccuracy: score, depth: score, clarity: score },
          strengths: [],
          improvements: [],
          conciseFeedback: 'Feedback',
          evidence: authorityState === 'AUTHORITATIVE' ? [`Evidence ${turnNumber}`] : [],
        },
      },
    });

    prisma.shareToken.findUnique.mockResolvedValue({
      id: 'token-id-authoritative',
      token: 'authoritative-token',
      isRevoked: false,
      isAnonymized: true,
      expiresAt: new Date(Date.now() + 86400000),
      viewCount: 0,
      createdAt: new Date(),
      mentorFeedback: [],
      session: {
        id: mockSessionId,
        state: SessionState.COMPLETED,
        overallScore: 9.9,
        completedAt: new Date(),
        jobRole: { name: 'Backend Engineer' },
        seniorityLevel: { name: 'Senior' },
        technologies: [],
        user: { email: 'candidate@example.com', profile: { fullName: 'Candidate' } },
        turns: [
          makeTurn(1, 4, 'AUTHORITATIVE'),
          makeTurn(2, 6, 'AUTHORITATIVE'),
          makeTurn(3, 10, 'NEEDS_REVIEW'),
        ],
        learningPath: null,
      },
    });
    prisma.shareToken.update.mockResolvedValue({});

    const result = await service.getPublicSharedResult('authoritative-token');

    expect(result.session.overallScore).toBe(5);
    expect(result.session.rubricAverages.technicalAccuracy).toBe(5);
  });

  it('does not expose a public overall score derived only from review-needed output', async () => {
    prisma.shareToken.findUnique.mockResolvedValue({
      id: 'token-review-only',
      token: 'review-only-token',
      isRevoked: false,
      isAnonymized: true,
      expiresAt: new Date(Date.now() + 86400000),
      viewCount: 0,
      createdAt: new Date(),
      mentorFeedback: [],
      session: {
        id: mockSessionId,
        state: SessionState.COMPLETED,
        overallScore: 9.9,
        completedAt: new Date(),
        jobRole: { name: 'Backend Engineer' },
        seniorityLevel: { name: 'Senior' },
        technologies: [],
        user: { email: 'candidate@example.com', profile: { fullName: 'Candidate' } },
        turns: [
          {
            turnNumber: 1,
            difficulty: 2,
            status: 'EVALUATED',
            question: { content: 'Question', keyFocus: 'Focus' },
            answer: {
              content: 'Answer',
              submittedAt: new Date(),
              evaluation: {
                score: 9.9,
                authorityState: 'NEEDS_REVIEW',
                needsReview: true,
                provider: 'mock',
                rubricScores: { technicalAccuracy: 9.9, depth: 9.9, clarity: 9.9 },
                strengths: [],
                improvements: [],
                conciseFeedback: 'Mock feedback',
                evidence: [],
              },
            },
          },
        ],
        learningPath: null,
      },
    });
    prisma.shareToken.update.mockResolvedValue({});

    const result = await service.getPublicSharedResult('review-only-token');

    expect(result.session.overallScore).toBeNull();
    expect(result.session.rubricAverages.technicalAccuracy).toBe(0);
  });

  it('should allow adding mentor feedback to a shared session', async () => {
    prisma.shareToken.findUnique.mockResolvedValue({
      id: 'token-id-1',
      token: 'valid-token',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 86400000),
    });

    prisma.mentorFeedback.create.mockResolvedValue({
      id: 'feedback-1',
      shareTokenId: 'token-id-1',
      turnNumber: 1,
      mentorName: 'Staff Tech Lead',
      comment: 'Very solid reasoning on trade-offs.',
      createdAt: new Date(),
    });

    const result = await service.addMentorFeedback('valid-token', {
      turnNumber: 1,
      mentorName: 'Staff Tech Lead',
      comment: 'Very solid reasoning on trade-offs.',
    });

    expect(result.mentorName).toBe('Staff Tech Lead');
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('should reject feedback on passcode-protected share link if passcode is missing', async () => {
    prisma.shareToken.findUnique.mockResolvedValue({
      id: 'token-id-1',
      token: 'protected-token',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 86400000),
      passcodeHash: '$2b$10$xyz...', // protected
    });

    await expect(
      service.addMentorFeedback('protected-token', {
        mentorName: 'Mentor',
        comment: 'Great answer',
      }),
    ).rejects.toThrow(DomainException);
  });

  it('should reject feedback on passcode-protected share link if passcode is invalid', async () => {
    const validHash = await bcrypt.hash('secret123', 10);

    prisma.shareToken.findUnique.mockResolvedValue({
      id: 'token-id-1',
      token: 'protected-token',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 86400000),
      passcodeHash: validHash,
    });

    await expect(
      service.addMentorFeedback('protected-token', {
        mentorName: 'Mentor',
        comment: 'Great answer',
        passcode: 'wrong-passcode',
      }),
    ).rejects.toThrow(DomainException);
  });

  it('should accept feedback on passcode-protected share link when correct passcode is provided', async () => {
    const validHash = await bcrypt.hash('secret123', 10);

    prisma.shareToken.findUnique.mockResolvedValue({
      id: 'token-id-1',
      token: 'protected-token',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 86400000),
      passcodeHash: validHash,
    });

    prisma.mentorFeedback.create.mockResolvedValue({
      id: 'feedback-1',
      shareTokenId: 'token-id-1',
      turnNumber: null,
      mentorName: 'Mentor Authorized',
      comment: 'Great answer',
      createdAt: new Date(),
    });

    const result = await service.addMentorFeedback('protected-token', {
      mentorName: 'Mentor Authorized',
      comment: 'Great answer',
      passcode: 'secret123',
    });

    expect(result.mentorName).toBe('Mentor Authorized');
  });
});
