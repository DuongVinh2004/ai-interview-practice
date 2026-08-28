import { Test, TestingModule } from '@nestjs/testing';
import { AudioController } from './audio.controller';
import { AudioOrchestratorService } from './audio-orchestrator.service';
import { AudioVoice } from '@ai-interview/contracts';

describe('AudioController', () => {
  let controller: AudioController;
  let mockAudioService: any;

  beforeEach(async () => {
    mockAudioService = {
      transcribeAudio: jest.fn().mockResolvedValue({
        text: 'This is a test answer about Node.js event loops.',
        confidence: 0.97,
        durationSeconds: 5,
        detectedLanguage: 'en',
        provider: 'mock',
      }),
      synthesizeSpeech: jest.fn().mockResolvedValue({
        audioBuffer: Buffer.from('RIFF....WAVEfmt...'),
        mimeType: 'audio/wav',
        durationSeconds: 4,
        provider: 'mock',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AudioController],
      providers: [
        { provide: AudioOrchestratorService, useValue: mockAudioService },
      ],
    }).compile();

    controller = module.get<AudioController>(AudioController);
  });

  describe('transcribeAudio', () => {
    it('transcribes uploaded webm file successfully', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'answer.webm',
        encoding: '7bit',
        mimetype: 'audio/webm',
        buffer: Buffer.alloc(16000),
        size: 16000,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await controller.transcribeAudio(
        'user-1',
        mockFile,
        'en',
        'session-1',
        'audio-transcribe-1',
      );

      expect(result).toBeDefined();
      expect(result.text).toBe('This is a test answer about Node.js event loops.');
      expect(mockAudioService.transcribeAudio).toHaveBeenCalledWith(
        'user-1',
        mockFile.buffer,
        'audio/webm',
        'answer.webm',
        'en',
        'session-1',
        'audio-transcribe-1',
      );
    });

    it('rejects unsupported audio formats with 400 DomainException', async () => {
      const invalidFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'video.avi',
        encoding: '7bit',
        mimetype: 'video/x-msvideo',
        buffer: Buffer.alloc(100),
        size: 100,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      await expect(controller.transcribeAudio('user-1', invalidFile)).rejects.toThrow(
        /Unsupported audio format/,
      );
    });

    it('rejects missing file with 400 DomainException', async () => {
      await expect(controller.transcribeAudio('user-1', undefined)).rejects.toThrow(
        /No audio file uploaded/,
      );
    });
  });

  describe('synthesizeSpeech', () => {
    it('synthesizes text to base64 audio response', async () => {
      const result = await controller.synthesizeSpeech(
        'user-1',
        {
          text: 'What is database sharding?',
          voice: AudioVoice.ALLOY,
          speed: 1.0,
        },
        undefined,
        'audio-synthesize-1',
      );

      expect(result).toBeDefined();
      expect(result.audioBase64).toBeDefined();
      expect(result.mimeType).toBe('audio/wav');
      expect(mockAudioService.synthesizeSpeech).toHaveBeenCalledWith(
        'user-1',
        'What is database sharding?',
        AudioVoice.ALLOY,
        1.0,
        undefined,
        'audio-synthesize-1',
      );
    });
  });
});
