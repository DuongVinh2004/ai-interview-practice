import { Test, TestingModule } from '@nestjs/testing';
import { VoiceStreamingGateway } from './gateways/voice-streaming.gateway';
import { VadEngineService } from './services/vad-engine.service';
import { MockVoiceProvider } from './providers/mock-voice.provider';
import { PrismaService } from '../platform/prisma/prisma.service';
import { VoiceEventType, VoiceSessionStatus, SpeakerRole } from '@ai-interview/contracts';

describe('VoiceStreamingGateway (F001 Live Voice Streaming)', () => {
  let gateway: VoiceStreamingGateway;
  let vad: VadEngineService;
  let voiceProvider: MockVoiceProvider;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceStreamingGateway,
        VadEngineService,
        MockVoiceProvider,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    gateway = module.get<VoiceStreamingGateway>(VoiceStreamingGateway);
    vad = module.get<VadEngineService>(VadEngineService);
    voiceProvider = module.get<MockVoiceProvider>(MockVoiceProvider);
    jest.clearAllMocks();
  });

  it('handles client connection and initializes voice session on CONNECT event', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      id: 'int-123',
      userId: 'user-1',
      jobRole: { name: 'Staff Backend Engineer' },
      turns: [
        { turnNumber: 1, question: { content: 'Explain distributed locking protocols.' } },
      ],
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
      on: jest.fn(),
    };

    gateway.handleConnection(mockWs);

    // Trigger message handler registered via mockWs.on('message', ...)
    const messageHandler = mockWs.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    await messageHandler(
      JSON.stringify({
        type: VoiceEventType.CONNECT,
        interviewId: 'int-123',
      }),
      false
    );

    expect(mockPrisma.voiceSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { interviewId: 'int-123' },
      })
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
      on: jest.fn(),
    };

    gateway.handleConnection(mockWs);
    const messageHandler = mockWs.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

    // Manual interrupt event
    await messageHandler(
      JSON.stringify({
        type: VoiceEventType.INTERRUPT,
      }),
      false
    );

    const bargeInEvent = sentMessages.find(m => m.type === VoiceEventType.INTERRUPT);
    expect(bargeInEvent).toBeDefined();
    expect(bargeInEvent.bargeInCount).toBe(1);
  });
});
