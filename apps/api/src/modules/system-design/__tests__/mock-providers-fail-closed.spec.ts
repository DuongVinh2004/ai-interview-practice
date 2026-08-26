import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockVisionProvider } from '../providers/mock-vision.provider';
import { MockVoiceProvider } from '../../voice-gateway/providers/mock-voice.provider';
import { DeepgramSttProvider } from '../../voice-gateway/providers/deepgram-stt.provider';
import { ElevenLabsTtsProvider } from '../../voice-gateway/providers/elevenlabs-tts.provider';
import { MockEmailProvider } from '../../email/providers/mock-email.provider';
import { MockStorageProvider } from '../../storage/providers/mock-storage.provider';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ErrorCode } from '@ai-interview/contracts';

describe('Authoritative Mock Output Fail-Closed (AG-PACKET-006 / FUNC-001)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('MockVisionProvider', () => {
    it('fails closed in production when ALLOW_MOCK_PROVIDERS is not true', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_MOCK_PROVIDERS;

      const provider = new MockVisionProvider();
      await expect(
        provider.evaluateDiagram({
          imageBase64: 'data:image/png;base64,mock',
          language: 'en',
        }),
      ).rejects.toThrow(DomainException);

      try {
        await provider.evaluateDiagram({
          imageBase64: 'data:image/png;base64,mock',
          language: 'en',
        });
      } catch (err: any) {
        expect(err.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(err.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
      }
    });

    it('allows mock execution in production when ALLOW_MOCK_PROVIDERS=true', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_MOCK_PROVIDERS = 'true';

      const provider = new MockVisionProvider();
      const result = await provider.evaluateDiagram({
        imageBase64: 'data:image/png;base64,mock',
        language: 'en',
      });
      expect(result.overallScore).toBeDefined();
    });

    it('allows mock execution in test / development environments', async () => {
      process.env.NODE_ENV = 'test';
      delete process.env.ALLOW_MOCK_PROVIDERS;

      const provider = new MockVisionProvider();
      const result = await provider.evaluateDiagram({
        imageBase64: 'data:image/png;base64,mock',
        language: 'en',
      });
      expect(result.overallScore).toBeDefined();
    });
  });

  describe('MockVoiceProvider', () => {
    it('fails closed in production when ALLOW_MOCK_PROVIDERS is not set', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_MOCK_PROVIDERS;

      const provider = new MockVoiceProvider();
      await expect(provider.transcribeAudio(Buffer.from('test'))).rejects.toThrow(DomainException);
    });

    it('allows mock synthesis in non-production environments', async () => {
      process.env.NODE_ENV = 'development';
      const provider = new MockVoiceProvider();
      const text = await provider.transcribeAudio(Buffer.from('test'));
      expect(text).toBeDefined();
    });
  });

  describe('DeepgramSttProvider', () => {
    it('fails closed in production if unconfigured and ALLOW_MOCK_PROVIDERS is not set', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_MOCK_PROVIDERS;

      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'voice.deepgramApiKey') return '';
          if (key === 'app.env') return 'production';
          return null;
        }),
      } as unknown as ConfigService;

      const provider = new DeepgramSttProvider(mockConfigService);
      expect(() => provider.createSttStream()).toThrow(DomainException);
    });
  });

  describe('ElevenLabsTtsProvider', () => {
    it('fails closed in production if unconfigured and ALLOW_MOCK_PROVIDERS is not set', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_MOCK_PROVIDERS;

      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'voice.elevenlabsApiKey') return '';
          if (key === 'app.env') return 'production';
          return null;
        }),
      } as unknown as ConfigService;

      const provider = new ElevenLabsTtsProvider(mockConfigService);
      expect(() => provider.createStreamingSession()).toThrow(DomainException);
    });
  });

  describe('MockEmailProvider', () => {
    it('fails closed in production when ALLOW_MOCK_PROVIDERS is not set', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_MOCK_PROVIDERS;

      const provider = new MockEmailProvider();
      await expect(
        provider.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('MockStorageProvider', () => {
    it('fails closed in production when ALLOW_MOCK_PROVIDERS is not set', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_MOCK_PROVIDERS;

      const provider = new MockStorageProvider();
      await expect(
        provider.generatePresignedUploadUrl('uploads/avatar.png', 'image/png'),
      ).rejects.toThrow(DomainException);
    });
  });
});
