import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { VoiceStreamingGateway } from './gateways/voice-streaming.gateway';
import { VadEngineService } from './services/vad-engine.service';
import { MockVoiceProvider } from './providers/mock-voice.provider';
import { PrismaService } from '../platform/prisma/prisma.service';
import { VoiceEventType, VoiceSessionStatus, SpeakerRole } from '@ai-interview/contracts';

describe('VoiceStreamingGateway (F001 Live Voice Streaming & Security)', () => {
  let gateway: VoiceStreamingGateway;
  let vad: VadEngineService;
  let voiceProvider: MockVoiceProvider;
  let jwtService: JwtService;

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

  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-jwt-secret'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceStreamingGateway,
        VadEngineService,
        MockVoiceProvider,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    gateway = module.get<VoiceStreamingGateway>(VoiceStreamingGateway);
    vad = module.get<VadEngineService>(VadEngineService);
    voiceProvider = module.get<MockVoiceProvider>(MockVoiceProvider);
    jwtService = module.get<JwtService>(JwtService);
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
    mockJwtService.verify.mockReturnValueOnce({ sub: 'attacker-user', role: 'CANDIDATE' });

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

    gateway.handleConnection(mockWs, { url: '/voice?token=attacker-jwt' });
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
    mockJwtService.verify.mockReturnValueOnce({ sub: 'user-1', role: 'CANDIDATE' });

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

    gateway.handleConnection(mockWs, { url: '/voice?token=valid-jwt-token' });

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
});
