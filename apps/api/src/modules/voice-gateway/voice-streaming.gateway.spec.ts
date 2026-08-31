import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { VoiceStreamingGateway } from './gateways/voice-streaming.gateway';
import { VadEngineService } from './services/vad-engine.service';
import { MockVoiceProvider } from './providers/mock-voice.provider';
import { DeepgramSttProvider } from './providers/deepgram-stt.provider';
import { ElevenLabsTtsProvider } from './providers/elevenlabs-tts.provider';
import { SentenceChunkerService } from './services/sentence-chunker.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { EntitlementReservationService } from '../billing/entitlement-reservation.service';
import {
  VoiceEventType,
  VoiceSessionStatus,
  SpeakerRole,
  UserRole,
  UserStatus,
} from '@ai-interview/contracts';

describe('VoiceStreamingGateway (F001 Live Voice Streaming & Security - AG-PACKET-002)', () => {
  let gateway: VoiceStreamingGateway;
  let authService: AuthService;
  let deepgramStt: DeepgramSttProvider;

  const mockPrisma = {
    interviewSession: {
      findUnique: jest.fn(),
    },
    voiceSession: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    voiceTranscript: {
      create: jest.fn().mockResolvedValue({ id: 'trans-1' }),
    },
  };

  const mockAuthService = {
    validateAccessToken: jest.fn(),
  };
  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockEntitlementReservations = {
    reserve: jest.fn(),
    markProviderDispatchStarted: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn(),
    markForReconciliation: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'jwt.accessSecret') return 'test-jwt-secret';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceStreamingGateway,
        VadEngineService,
        MockVoiceProvider,
        DeepgramSttProvider,
        ElevenLabsTtsProvider,
        SentenceChunkerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: EntitlementReservationService, useValue: mockEntitlementReservations },
      ],
    }).compile();

    gateway = module.get<VoiceStreamingGateway>(VoiceStreamingGateway);
    authService = module.get<AuthService>(AuthService);
    deepgramStt = module.get<DeepgramSttProvider>(DeepgramSttProvider);
    const elevenLabsTts = module.get<ElevenLabsTtsProvider>(ElevenLabsTtsProvider);

    jest.spyOn(deepgramStt, 'isPaidConfigured').mockReturnValue(false);
    jest.spyOn(elevenLabsTts, 'isPaidConfigured').mockReturnValue(false);
    jest.clearAllMocks();
  });

  it('rejects connection if unauthenticated (no JWT token provided)', async () => {
    const sentMessages: any[] = [];
    const mockWs: any = {
      readyState: 1,
      send: jest.fn().mockImplementation((data: any) => {
        if (typeof data === 'string') sentMessages.push(JSON.parse(data));
      }),
      close: jest.fn(),
      on: jest.fn(),
    };

    gateway.handleConnection(mockWs);
    const messageHandler = mockWs.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    await messageHandler(
      JSON.stringify({
        type: VoiceEventType.CONNECT,
        interviewId: 'int-123',
      }),
      false,
    );

    const errorEvent = sentMessages.find(m => m.type === VoiceEventType.ERROR);
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toContain('Authentication required');
    expect(mockWs.close).toHaveBeenCalledWith(1008, 'Unauthorized');
  });

  it('rejects connection if user attempts to hijack an interview session owned by another user', async () => {
    mockAuthService.validateAccessToken.mockResolvedValueOnce({
      sub: 'attacker-user',
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
    });

    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      id: 'int-victim',
      userId: 'victim-user',
      jobRole: { name: 'Staff Backend Engineer' },
      turns: [],
    });

    const sentMessages: any[] = [];
    const mockWs: any = {
      readyState: 1,
      send: jest.fn().mockImplementation((data: any) => {
        if (typeof data === 'string') sentMessages.push(JSON.parse(data));
      }),
      close: jest.fn(),
      on: jest.fn(),
    };

    await gateway.handleConnection(mockWs, { url: '/voice?token=attacker-jwt' });
    const messageHandler = mockWs.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    await messageHandler(
      JSON.stringify({
        type: VoiceEventType.CONNECT,
        interviewId: 'int-victim',
      }),
      false,
    );

    const errorEvent = sentMessages.find(m => m.type === VoiceEventType.ERROR);
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toContain('Forbidden');
    expect(mockWs.close).toHaveBeenCalledWith(1008, 'Forbidden');
    expect(mockPrisma.voiceSession.upsert).not.toHaveBeenCalled();
  });

  it('handles client connection and initializes voice session on authenticated CONNECT event', async () => {
    mockAuthService.validateAccessToken.mockResolvedValueOnce({
      sub: 'user-1',
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
    });

    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      id: 'int-123',
      userId: 'user-1',
      jobRole: { name: 'Staff Backend Engineer' },
      turns: [{ turnNumber: 1, question: { content: 'Explain distributed locking protocols.' } }],
    });

    mockPrisma.voiceSession.upsert.mockResolvedValueOnce({
      id: 'voice-sess-1',
      interviewId: 'int-123',
      status: VoiceSessionStatus.ACTIVE,
    });

    const sentMessages: any[] = [];
    const mockWs: any = {
      readyState: 1, // WebSocket.OPEN
      send: jest.fn().mockImplementation((data: any) => {
        if (typeof data === 'string') {
          sentMessages.push(JSON.parse(data));
        }
      }),
      close: jest.fn(),
      on: jest.fn(),
    };

    await gateway.handleConnection(mockWs, { url: '/voice?token=valid-jwt-token' });

    const messageHandler = mockWs.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    await messageHandler(
      JSON.stringify({
        type: VoiceEventType.CONNECT,
        interviewId: 'int-123',
      }),
      false,
    );

    expect(mockPrisma.voiceSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { interviewId: 'int-123' },
      }),
    );

    const startEvent = sentMessages.find(m => m.type === VoiceEventType.CONNECTED);
    expect(startEvent).toBeDefined();
    expect(startEvent.sessionId).toBe('voice-sess-1');

    const transcriptEvent = sentMessages.find(m => m.type === VoiceEventType.AI_SPEAKING_START);
    expect(transcriptEvent).toBeDefined();
    expect(transcriptEvent.speaker).toBe(SpeakerRole.AI);
  });

  it('rejects connection if token is a temporary MFA challenge token (fails closed)', async () => {
    mockAuthService.validateAccessToken.mockRejectedValueOnce(
      new Error('MFA verification required. Challenge token cannot access protected endpoints.'),
    );

    const sentMessages: any[] = [];
    const mockWs: any = {
      readyState: 1,
      send: jest.fn().mockImplementation((data: any) => {
        if (typeof data === 'string') sentMessages.push(JSON.parse(data));
      }),
      close: jest.fn(),
      on: jest.fn(),
    };

    await gateway.handleConnection(mockWs, { url: '/voice?token=mfa-challenge-token' });
    const messageHandler = mockWs.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    await messageHandler(
      JSON.stringify({
        type: VoiceEventType.CONNECT,
        interviewId: 'int-123',
      }),
      false,
    );

    expect(mockWs.close).toHaveBeenCalledWith(1008, 'Unauthorized');
  });

  it('rejects connection if user account is locked (fails closed)', async () => {
    mockAuthService.validateAccessToken.mockRejectedValueOnce(
      new Error('Your account has been locked. Please contact support.'),
    );

    const sentMessages: any[] = [];
    const mockWs: any = {
      readyState: 1,
      send: jest.fn().mockImplementation((data: any) => {
        if (typeof data === 'string') sentMessages.push(JSON.parse(data));
      }),
      close: jest.fn(),
      on: jest.fn(),
    };

    await gateway.handleConnection(mockWs, { url: '/voice?token=locked-user-token' });
    const messageHandler = mockWs.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    await messageHandler(
      JSON.stringify({
        type: VoiceEventType.CONNECT,
        interviewId: 'int-123',
      }),
      false,
    );

    expect(mockWs.close).toHaveBeenCalledWith(1008, 'Unauthorized');
  });

  it('rejects connection if token has been revoked / tokenVersion mismatch (fails closed)', async () => {
    mockAuthService.validateAccessToken.mockRejectedValueOnce(
      new Error('Session invalidated due to password change or security update'),
    );

    const sentMessages: any[] = [];
    const mockWs: any = {
      readyState: 1,
      send: jest.fn().mockImplementation((data: any) => {
        if (typeof data === 'string') sentMessages.push(JSON.parse(data));
      }),
      close: jest.fn(),
      on: jest.fn(),
    };

    await gateway.handleConnection(mockWs, { url: '/voice?token=revoked-stale-token' });
    const messageHandler = mockWs.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    await messageHandler(
      JSON.stringify({
        type: VoiceEventType.CONNECT,
        interviewId: 'int-123',
      }),
      false,
    );

    expect(mockWs.close).toHaveBeenCalledWith(1008, 'Unauthorized');
  });

  it('rejects cross-owner access when current database role is downgraded to CANDIDATE despite stale ADMIN claim in token', async () => {
    mockAuthService.validateAccessToken.mockResolvedValueOnce({
      sub: 'downgraded-admin-user',
      role: UserRole.CANDIDATE, // Database returns CANDIDATE role
      status: UserStatus.ACTIVE,
    });

    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      id: 'int-other-user',
      userId: 'other-user',
      jobRole: { name: 'Staff Backend Engineer' },
      turns: [],
    });

    const sentMessages: any[] = [];
    const mockWs: any = {
      readyState: 1,
      send: jest.fn().mockImplementation((data: any) => {
        if (typeof data === 'string') sentMessages.push(JSON.parse(data));
      }),
      close: jest.fn(),
      on: jest.fn(),
    };

    await gateway.handleConnection(mockWs, { url: '/voice?token=stale-admin-token' });
    const messageHandler = mockWs.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    await messageHandler(
      JSON.stringify({
        type: VoiceEventType.CONNECT,
        interviewId: 'int-other-user',
      }),
      false,
    );

    const errorEvent = sentMessages.find(m => m.type === VoiceEventType.ERROR);
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toContain('Forbidden');
    expect(mockWs.close).toHaveBeenCalledWith(1008, 'Forbidden');
  });

  it('rejects binary audio streaming before authentication and connection', async () => {
    const sentMessages: any[] = [];
    const mockWs: any = {
      readyState: 1,
      send: jest.fn().mockImplementation((data: any) => {
        if (typeof data === 'string') sentMessages.push(JSON.parse(data));
      }),
      close: jest.fn(),
      on: jest.fn(),
    };

    gateway.handleConnection(mockWs);
    const messageHandler = mockWs.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    const pcmChunk = Buffer.alloc(320); // 20ms of 16kHz audio
    await messageHandler(pcmChunk, true);

    expect(mockWs.close).toHaveBeenCalledWith(1008, 'Unauthorized audio frame stream');
  });

  it('processes binary audio chunk and detects barge-in to interrupt AI speaking', async () => {
    const sentMessages: any[] = [];
    const mockWs: any = {
      readyState: 1,
      send: jest.fn().mockImplementation((data: any) => {
        if (typeof data === 'string') {
          sentMessages.push(JSON.parse(data));
        }
      }),
      close: jest.fn(),
      on: jest.fn(),
    };

    gateway.handleConnection(mockWs);
    const messageHandler = mockWs.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    // Manual interrupt event
    await messageHandler(
      JSON.stringify({
        type: VoiceEventType.INTERRUPT,
      }),
      false,
    );

    const bargeInEvent = sentMessages.find(m => m.type === VoiceEventType.INTERRUPT);
    expect(bargeInEvent).toBeDefined();
    expect(bargeInEvent.bargeInCount).toBe(1);
  });

  it('enforces single active WebSocket connection per user and disconnects older session', async () => {
    mockAuthService.validateAccessToken.mockResolvedValue({
      sub: 'user-single-conn',
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
    });

    const sentWs1: any[] = [];
    const mockWs1: any = {
      readyState: 1,
      send: jest.fn().mockImplementation(data => sentWs1.push(JSON.parse(data))),
      close: jest.fn(),
      on: jest.fn(),
    };

    const sentWs2: any[] = [];
    const mockWs2: any = {
      readyState: 1,
      send: jest.fn().mockImplementation(data => sentWs2.push(JSON.parse(data))),
      close: jest.fn(),
      on: jest.fn(),
    };

    // Connect first client
    await gateway.handleConnection(mockWs1, { url: '/voice?token=token-1' });
    // Connect second client for same user
    await gateway.handleConnection(mockWs2, { url: '/voice?token=token-1' });

    // First client should be closed with code 1008
    expect(mockWs1.close).toHaveBeenCalledWith(1008, 'Concurrent connection replaced');
  });

  it('rejects before opening a paid stream when the atomic entitlement reservation is exhausted', async () => {
    mockAuthService.validateAccessToken.mockResolvedValueOnce({
      sub: 'user-quota-test',
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
    });

    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      id: 'int-quota',
      userId: 'user-quota-test',
      jobRole: { name: 'Staff Backend Engineer' },
      turns: [],
    });

    mockPrisma.voiceSession.upsert.mockResolvedValueOnce({
      id: 'voice-quota-sess',
      interviewId: 'int-quota',
      status: VoiceSessionStatus.ACTIVE,
    });

    jest.spyOn(deepgramStt, 'isPaidConfigured').mockReturnValue(true);
    mockJwtService.verify.mockReturnValueOnce({
      sub: 'user-quota-test',
      role: UserRole.CANDIDATE,
      tokenType: 'VOICE_TICKET',
      jti: 'ticket-quota-1',
    });
    mockEntitlementReservations.reserve.mockRejectedValueOnce(new Error('Quota exhausted'));

    const sentMessages: any[] = [];
    const mockWs: any = {
      readyState: 1,
      send: jest.fn().mockImplementation(data => {
        if (typeof data === 'string') sentMessages.push(JSON.parse(data));
      }),
      close: jest.fn(),
      on: jest.fn(),
    };

    await gateway.handleConnection(mockWs, { url: '/voice?ticket=single-use-ticket' });
    const messageHandler = mockWs.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    await messageHandler(
      JSON.stringify({
        type: VoiceEventType.CONNECT,
        interviewId: 'int-quota',
      }),
      false,
    );

    const quotaError = sentMessages.find(m => m.type === VoiceEventType.QUOTA_EXCEEDED);
    expect(quotaError).toBeDefined();
    expect(mockWs.close).toHaveBeenCalledWith(1008, 'Quota Exceeded');
  });
});
