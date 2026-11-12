import { Test, TestingModule } from '@nestjs/testing';
import { ElevenLabsTtsProvider } from './elevenlabs-tts.provider';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

jest.mock('ws', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('events');
  class Socket extends EventEmitter {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSED = 3;
    static instances: Socket[] = [];
    readyState = 0;
    send = jest.fn();
    close = jest.fn((code?: number) => {
      this.readyState = Socket.CLOSED;
      this.emit('close', code || 1000);
    });
    constructor(
      public url: string,
      public options?: any,
    ) {
      super();
      Socket.instances.push(this);
    }
  }
  return { __esModule: true, default: Socket };
});

describe('ElevenLabsTtsProvider (Module B3)', () => {
  let provider: ElevenLabsTtsProvider;

  beforeEach(() => {
    (WebSocket as any).instances = [];
    jest.clearAllMocks();
  });

  describe('Mock Mode (Unconfigured)', () => {
    beforeEach(async () => {
      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'voice.elevenlabsApiKey') return 'mock-key';
          return null;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [ElevenLabsTtsProvider, { provide: ConfigService, useValue: mockConfig }],
      }).compile();

      provider = module.get<ElevenLabsTtsProvider>(ElevenLabsTtsProvider);
    });

    it('identifies as not paid-configured when key contains mock', () => {
      expect(provider.isPaidConfigured()).toBe(false);
    });

    it('creates streaming session and emits synthetic PCM chunks', done => {
      const session = provider.createStreamingSession();
      let receivedChunks = 0;

      session.audioStream.subscribe({
        next: (chunk: Buffer) => {
          receivedChunks++;
          expect(chunk.length).toBe(640);
          if (receivedChunks >= 2) {
            session.close();
            done();
          }
        },
      });

      session.sendText('Hello candidate, welcome to your mock interview.');
    });

    it('completes audio stream on flush in mock mode', done => {
      const session = provider.createStreamingSession();

      session.audioStream.subscribe({
        complete: () => {
          done();
        },
      });

      session.sendText('Short phrase');
      session.flush();
    });
  });

  describe('Production Guard', () => {
    it('throws DomainException in production when TTS is unconfigured and allowMock is false', () => {
      const prevEnv = process.env.NODE_ENV;
      const prevAllowMock = process.env.ALLOW_MOCK_PROVIDERS;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.ALLOW_MOCK_PROVIDERS;
        delete process.env.ELEVENLABS_API_KEY;
        delete process.env.DEEPGRAM_API_KEY;

        const config = {
          get: jest.fn((key: string) => {
            if (key === 'app.env' || key === 'NODE_ENV') return 'production';
            return null;
          }),
        };

        const prodProvider = new ElevenLabsTtsProvider(config as any);
        expect(prodProvider.isPaidConfigured()).toBe(false);
        expect(() => prodProvider.createStreamingSession()).toThrow(DomainException);
      } finally {
        process.env.NODE_ENV = prevEnv;
        if (prevAllowMock !== undefined) {
          process.env.ALLOW_MOCK_PROVIDERS = prevAllowMock;
        } else {
          delete process.env.ALLOW_MOCK_PROVIDERS;
        }
      }
    });
  });

  describe('Live WebSocket Mode (Real API Key)', () => {
    let liveProvider: ElevenLabsTtsProvider;

    beforeEach(() => {
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'voice.elevenlabsApiKey') return 'valid-elevenlabs-key-xyz-12345';
          if (key === 'voice.elevenlabsVoiceId') return 'custom-voice-id';
          return null;
        }),
      };
      liveProvider = new ElevenLabsTtsProvider(config as any);
    });

    it('identifies as paid-configured with valid key', () => {
      expect(liveProvider.isPaidConfigured()).toBe(true);
    });

    it('connects to ElevenLabs WebSocket with eleven_turbo_v2_5 and pcm_24000', () => {
      const session = liveProvider.createStreamingSession();
      expect((WebSocket as any).instances).toHaveLength(1);
      const socket = (WebSocket as any).instances[0];

      expect(socket.url).toContain(
        'api.elevenlabs.io/v1/text-to-speech/custom-voice-id/stream-input',
      );
      expect(socket.url).toContain('model_id=eleven_turbo_v2_5');
      expect(socket.url).toContain('output_format=pcm_24000');
      expect(socket.options.headers['xi-api-key']).toBe('valid-elevenlabs-key-xyz-12345');

      session.close();
    });

    it('sends initial config frame and queued sentences on socket open', () => {
      const session = liveProvider.createStreamingSession();
      const socket = (WebSocket as any).instances[0];

      session.sendText('Question 1.');
      session.sendText('Question 2.');

      expect(socket.send).not.toHaveBeenCalled();

      socket.readyState = 1; // OPEN
      socket.emit('open');

      // 1. Initial config
      expect(socket.send).toHaveBeenNthCalledWith(
        1,
        JSON.stringify({
          text: ' ',
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
          generation_config: { chunk_length_schedule: [120, 160, 250, 290] },
        }),
      );

      // 2. Queued sentences with try_trigger_generation
      expect(socket.send).toHaveBeenNthCalledWith(
        2,
        JSON.stringify({ text: 'Question 1. ', try_trigger_generation: true }),
      );
      expect(socket.send).toHaveBeenNthCalledWith(
        3,
        JSON.stringify({ text: 'Question 2. ', try_trigger_generation: true }),
      );

      session.close();
    });

    it('dispatches flush signal { text: "" } when flush() is invoked', () => {
      const session = liveProvider.createStreamingSession();
      const socket = (WebSocket as any).instances[0];
      socket.readyState = 1;
      socket.emit('open');

      session.flush();

      expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ text: '' }));
      session.close();
    });

    it('decodes base64 audio frames and emits Buffer chunks on audioStream', done => {
      const session = liveProvider.createStreamingSession();
      const socket = (WebSocket as any).instances[0];
      socket.readyState = 1;
      socket.emit('open');

      const rawPcm = Buffer.from([10, 20, 30, 40]);
      const base64Audio = rawPcm.toString('base64');

      session.audioStream.subscribe({
        next: chunk => {
          expect(chunk).toEqual(rawPcm);
          session.close();
          done();
        },
      });

      socket.emit('message', Buffer.from(JSON.stringify({ audio: base64Audio })));
    });

    it('completes audioStream when isFinal frame is received', done => {
      const session = liveProvider.createStreamingSession();
      const socket = (WebSocket as any).instances[0];
      socket.readyState = 1;
      socket.emit('open');

      session.audioStream.subscribe({
        complete: () => {
          done();
        },
      });

      socket.emit('message', Buffer.from(JSON.stringify({ isFinal: true })));
    });

    it('propagates error when socket fails and fallback is unavailable', done => {
      const session = liveProvider.createStreamingSession();
      const socket = (WebSocket as any).instances[0];

      session.audioStream.subscribe({
        error: err => {
          expect(err.message).toContain('ElevenLabs socket failed');
          done();
        },
      });

      socket.emit('error', new Error('ElevenLabs socket failed'));
    });
  });
});
