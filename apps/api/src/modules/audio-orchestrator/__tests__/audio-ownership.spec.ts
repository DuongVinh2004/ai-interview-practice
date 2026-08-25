import { HttpStatus } from '@nestjs/common';
import { AudioOrchestratorService } from '../audio-orchestrator.service';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ErrorCode } from '@ai-interview/contracts';

describe('Audio Ownership and IDOR Prevention (F-008)', () => {
  let service: AudioOrchestratorService;
  let mockPrisma: any;
  let mockConfig: any;
  let mockOpenAiProvider: any;
  let mockMockProvider: any;

  beforeEach(() => {
    mockPrisma = {
      interviewSession: {
        findUnique: jest.fn(),
      },
      aiRun: {
        create: jest.fn().mockResolvedValue({ id: 'run-1' }),
      },
    };
    mockConfig = {
      get: jest.fn((key: string, def: any) => def),
    };
    mockOpenAiProvider = {
      transcribe: jest.fn(),
      synthesize: jest.fn(),
    };
    mockMockProvider = {
      transcribe: jest.fn().mockResolvedValue({
        text: 'mock transcribed text',
        confidence: 0.95,
        durationSeconds: 5,
        provider: 'mock',
      }),
      synthesize: jest.fn().mockResolvedValue({
        audioBuffer: Buffer.from('mock-audio'),
        mimeType: 'audio/mp3',
        durationSeconds: 3,
        provider: 'mock',
      }),
    };

    service = new AudioOrchestratorService(
      mockPrisma as any,
      mockConfig as any,
      mockOpenAiProvider as any,
      mockMockProvider as any,
    );
  });

  it('MUST reject transcription when sessionId belongs to a different user (IDOR prevention)', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 'session-user-b',
      userId: 'user-b',
    });

    await expect(
      service.transcribeAudio(
        'user-a',
        Buffer.from('fake-audio'),
        'audio/webm',
        'test.webm',
        'en',
        'session-user-b',
      ),
    ).rejects.toThrow(DomainException);

    await expect(
      service.transcribeAudio(
        'user-a',
        Buffer.from('fake-audio'),
        'audio/webm',
        'test.webm',
        'en',
        'session-user-b',
      ),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.FORBIDDEN,
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('MUST reject speech synthesis when sessionId belongs to a different user', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 'session-user-b',
      userId: 'user-b',
    });

    await expect(
      service.synthesizeSpeech('user-a', 'Hello test', undefined, 1.0, 'session-user-b'),
    ).rejects.toThrow(DomainException);
  });

  it('MUST allow transcription when sessionId belongs to the calling user', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 'session-user-a',
      userId: 'user-a',
    });

    const result = await service.transcribeAudio(
      'user-a',
      Buffer.from('fake-audio'),
      'audio/webm',
      'test.webm',
      'en',
      'session-user-a',
    );

    expect(result.text).toBe('mock transcribed text');
  });
});
