import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AudioOrchestratorService } from './audio-orchestrator.service';
import { OpenAiAudioProvider } from './providers/openai-audio.provider';
import { MockAudioProvider } from './providers/mock-audio.provider';
import { PrismaService } from '../platform/prisma/prisma.service';
import { AudioVoice, AiRunStatus } from '@ai-interview/contracts';
import { EntitlementReservationService } from '../billing/entitlement-reservation.service';
import { DistributedBudgetService } from '../platform/budget/distributed-budget.service';

describe('AudioOrchestratorService', () => {
  let service: AudioOrchestratorService;
  let mockPrisma: any;
  let mockConfigService: any;
  let mockOpenAiProvider: any;
  let mockAudioProvider: any;
  let mockReservations: any;
  let mockBudget: any;

  beforeEach(async () => {
    mockPrisma = {
      aiRun: {
        create: jest.fn().mockResolvedValue({ id: 'test-run-id' }),
      },
      interviewSession: {
        findUnique: jest.fn().mockResolvedValue({ id: 'session-123', userId: 'user-1' }),
      },
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultVal: any) => {
        if (key === 'ai.provider') return 'mock';
        if (key === 'ai.providerPriority') return 'openai,mock';
        if (key === 'ai.dailyBudgetUsd') return 50.0;
        return defaultVal;
      }),
    };

    mockOpenAiProvider = {
      name: 'openai',
      transcribe: jest.fn(),
      synthesize: jest.fn(),
    };

    mockAudioProvider = new MockAudioProvider();
    mockReservations = {
      reserve: jest.fn(),
      markProviderDispatchStarted: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn(),
      release: jest.fn(),
      markForReconciliation: jest.fn(),
    };
    mockBudget = {
      reserve: jest.fn().mockResolvedValue({
        key: 'distributed-budget:ai-provider-global:2026-08-29',
        reservedMicros: 2_000_000,
      }),
      settle: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudioOrchestratorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OpenAiAudioProvider, useValue: mockOpenAiProvider },
        { provide: MockAudioProvider, useValue: mockAudioProvider },
        { provide: EntitlementReservationService, useValue: mockReservations },
        { provide: DistributedBudgetService, useValue: mockBudget },
      ],
    }).compile();

    service = module.get<AudioOrchestratorService>(AudioOrchestratorService);
  });

  describe('transcribeAudio', () => {
    it('successfully transcribes audio with mock provider and records aiRun', async () => {
      const dummyBuffer = Buffer.alloc(32000, 1); // 2 seconds of audio
      const result = await service.transcribeAudio(
        'user-1',
        dummyBuffer,
        'audio/webm',
        'test.webm',
        'en',
        'session-123',
        'audio-transcribe-1',
      );

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.provider).toBe('mock');
      expect(mockPrisma.aiRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId: 'session-123',
            provider: 'mock',
            status: AiRunStatus.SUCCESS,
          }),
        }),
      );
    });

    it('cascades to mock provider when primary OpenAI provider fails', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultVal: any) => {
        if (key === 'ai.provider') return 'router';
        if (key === 'ai.providerPriority') return 'openai,mock';
        return defaultVal;
      });

      // Re-init with router priority
      mockOpenAiProvider.transcribe.mockRejectedValue(new Error('OpenAI Rate Limited'));
      mockReservations.reserve.mockResolvedValue({
        id: 'reservation_openai_1',
        state: 'RESERVED',
        isNewReservation: true,
      });

      const dummyBuffer = Buffer.alloc(16000, 2);
      const result = await service.transcribeAudio(
        'user-1',
        dummyBuffer,
        'audio/wav',
        'test.wav',
        'vi',
        undefined,
        'audio-transcribe-2',
      );

      expect(result).toBeDefined();
      expect(result.provider).toBe('mock');
      expect(mockOpenAiProvider.transcribe).toHaveBeenCalled();
    });
  });

  describe('synthesizeSpeech', () => {
    it('synthesizes speech into valid audio buffer with mock provider', async () => {
      const result = await service.synthesizeSpeech(
        'user-1',
        'Welcome to your system design interview.',
        AudioVoice.ALLOY,
        1.0,
        'session-456',
        'audio-synthesize-1',
      );

      expect(result).toBeDefined();
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      expect(result.audioBuffer.length).toBeGreaterThan(44); // Has WAV header
      expect(result.mimeType).toBe('audio/wav');
      expect(result.provider).toBe('mock');
      expect(mockPrisma.aiRun.create).toHaveBeenCalled();
    });

    it('throws validation error when text is empty', async () => {
      await expect(
        service.synthesizeSpeech(
          'user-1',
          '',
          AudioVoice.NOVA,
          1.0,
          undefined,
          'audio-synthesize-2',
        ),
      ).rejects.toThrow();
    });
  });

  describe('paid provider entitlement boundary', () => {
    it('reserves before OpenAI synthesis and commits the measured duration exactly once', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultVal: any) => {
        if (key === 'ai.provider') return 'openai';
        if (key === 'ai.dailyBudgetUsd') return 50.0;
        return defaultVal;
      });
      mockReservations.reserve.mockResolvedValue({
        id: 'reservation_paid_audio',
        state: 'RESERVED',
        isNewReservation: true,
      });
      mockOpenAiProvider.synthesize.mockResolvedValue({
        audioBuffer: Buffer.from('audio'),
        mimeType: 'audio/mpeg',
        durationSeconds: 42,
        provider: 'openai',
        model: 'tts-1',
        latencyMs: 10,
        costEstimate: 0.01,
      });

      await service.synthesizeSpeech(
        'user-1',
        'A paid operation must reserve first.',
        AudioVoice.ALLOY,
        1,
        undefined,
        'audio-paid-1',
      );

      expect(mockReservations.reserve.mock.invocationCallOrder[0]).toBeLessThan(
        mockOpenAiProvider.synthesize.mock.invocationCallOrder[0],
      );
      expect(mockReservations.markProviderDispatchStarted.mock.invocationCallOrder[0]).toBeLessThan(
        mockOpenAiProvider.synthesize.mock.invocationCallOrder[0],
      );
      expect(mockBudget.reserve.mock.invocationCallOrder[0]).toBeLessThan(
        mockOpenAiProvider.synthesize.mock.invocationCallOrder[0],
      );
      expect(mockBudget.reserve).toHaveBeenCalledWith('ai-provider-global', 50, 2);
      expect(mockBudget.settle).toHaveBeenCalledWith(expect.any(Object), 0.01);
      expect(mockReservations.commit).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId: 'reservation_paid_audio',
          actualQuantity: 1,
        }),
      );
    });
  });

  describe('CircuitBreaker & Budget Guard', () => {
    it('reports circuit breaker instance', () => {
      const cb = service.getCircuitBreaker();
      expect(cb).toBeDefined();
      expect(cb.canExecute('mock', 'audio-transcribe')).toBe(true);
    });
  });
});
