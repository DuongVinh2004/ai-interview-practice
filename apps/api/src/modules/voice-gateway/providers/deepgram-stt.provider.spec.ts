import { Test, TestingModule } from '@nestjs/testing';
import { DeepgramSttProvider } from './deepgram-stt.provider';
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
    close = jest.fn(() => {
      this.readyState = Socket.CLOSED;
      this.emit('close');
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

describe('DeepgramSttProvider (Module B3)', () => {
  let provider: DeepgramSttProvider;

  beforeEach(() => {
    (WebSocket as any).instances = [];
    jest.clearAllMocks();
  });

  describe('Mock Mode (Unconfigured)', () => {
    beforeEach(async () => {
      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'voice.deepgramApiKey') return 'mock-key';
          return null;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [DeepgramSttProvider, { provide: ConfigService, useValue: mockConfig }],
      }).compile();

      provider = module.get<DeepgramSttProvider>(DeepgramSttProvider);
    });

    it('identifies as not paid-configured when key contains mock', () => {
      expect(provider.isPaidConfigured()).toBe(false);
    });

    it('creates STT stream and receives final transcript on close in mock mode', done => {
      const session = provider.createSttStream(16000);
      const audioChunk = Buffer.alloc(3200);

      session.events.subscribe(event => {
        if (event.isFinal) {
          expect(event.text).toBeDefined();
          expect(event.confidence).toBeGreaterThan(0.9);
          done();
        }
      });

      session.sendAudioChunk(audioChunk);
      session.close();
    });
  });

  describe('Production Guard', () => {
    it('throws DomainException in production when STT is unconfigured and allowMock is false', () => {
      const prevEnv = process.env.NODE_ENV;
      const prevAllowMock = process.env.ALLOW_MOCK_PROVIDERS;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.ALLOW_MOCK_PROVIDERS;
        delete process.env.DEEPGRAM_API_KEY;

        const config = {
          get: jest.fn((key: string) => {
            if (key === 'app.env' || key === 'NODE_ENV') return 'production';
            return null;
          }),
        };

        const prodProvider = new DeepgramSttProvider(config as any);
        expect(prodProvider.isPaidConfigured()).toBe(false);
        expect(() => prodProvider.createSttStream()).toThrow(DomainException);
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
    let liveProvider: DeepgramSttProvider;

    beforeEach(() => {
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'voice.deepgramApiKey') return 'valid-deepgram-token-xyz-12345';
          return null;
        }),
      };
      liveProvider = new DeepgramSttProvider(config as any);
    });

    it('identifies as paid-configured with valid key', () => {
      expect(liveProvider.isPaidConfigured()).toBe(true);
    });

    it('connects to Deepgram WebSocket with nova-2 model and linear16 encoding at 16kHz', () => {
      const session = liveProvider.createSttStream(16000, 'vi');
      expect((WebSocket as any).instances).toHaveLength(1);
      const socket = (WebSocket as any).instances[0];

      expect(socket.url).toContain('model=nova-2');
      expect(socket.url).toContain('encoding=linear16');
      expect(socket.url).toContain('sample_rate=16000');
      expect(socket.url).toContain('language=vi');
      expect(socket.url).toContain('interim_results=true');
      expect(socket.options.headers.Authorization).toBe('Token valid-deepgram-token-xyz-12345');

      session.close();
    });

    it('uses en-US language parameter when language is en', () => {
      const session = liveProvider.createSttStream(16000, 'en');
      const socket = (WebSocket as any).instances[0];
      expect(socket.url).toContain('language=en-US');
      session.close();
    });

    it('queues audio chunks while connecting and sends on socket open', () => {
      const session = liveProvider.createSttStream(16000);
      const socket = (WebSocket as any).instances[0];
      socket.readyState = 0; // CONNECTING

      const chunk1 = Buffer.from([1, 2, 3]);
      const chunk2 = Buffer.from([4, 5, 6]);
      session.sendAudioChunk(chunk1);
      session.sendAudioChunk(chunk2);

      expect(socket.send).not.toHaveBeenCalled();

      socket.readyState = 1; // OPEN
      socket.emit('open');

      expect(socket.send).toHaveBeenCalledWith(chunk1);
      expect(socket.send).toHaveBeenCalledWith(chunk2);

      session.close();
    });

    it('sends audio chunk directly when socket is already open', () => {
      const session = liveProvider.createSttStream(16000);
      const socket = (WebSocket as any).instances[0];
      socket.readyState = 1;
      socket.emit('open');

      const chunk = Buffer.from([10, 20, 30]);
      session.sendAudioChunk(chunk);

      expect(socket.send).toHaveBeenCalledWith(chunk);

      session.close();
    });

    it('emits interim and speech_final transcripts correctly', () => {
      const session = liveProvider.createSttStream(16000);
      const socket = (WebSocket as any).instances[0];
      const receivedEvents: any[] = [];
      session.events.subscribe(evt => receivedEvents.push(evt));

      // 1. Interim frame
      socket.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            is_final: false,
            speech_final: false,
            channel: { alternatives: [{ transcript: 'Hello', confidence: 0.85 }] },
          }),
        ),
      );

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].text).toBe('Hello');
      expect(receivedEvents[0].isFinal).toBe(false);

      // 2. Final frame
      socket.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            is_final: true,
            speech_final: true,
            channel: { alternatives: [{ transcript: 'Hello world.', confidence: 0.98 }] },
          }),
        ),
      );

      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[1].text).toBe('Hello world.');
      expect(receivedEvents[1].isFinal).toBe(true);
      expect(receivedEvents[1].confidence).toBe(0.98);

      session.close();
    });

    it('completes finish() promise upon CloseStream and Metadata message', async () => {
      const session = liveProvider.createSttStream(16000);
      const socket = (WebSocket as any).instances[0];
      socket.readyState = 1;
      socket.emit('open');

      const finishPromise = session.finish!();
      expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'CloseStream' }));

      // Simulate deepgram metadata reply
      socket.emit('message', Buffer.from(JSON.stringify({ type: 'Metadata' })));

      await expect(finishPromise).resolves.toBeUndefined();
      session.close();
    });

    it('propagates error event when socket emits error', done => {
      const session = liveProvider.createSttStream(16000);
      const socket = (WebSocket as any).instances[0];

      session.events.subscribe({
        error: err => {
          expect(err.message).toBe('Deepgram connection failed');
          done();
        },
      });

      socket.emit('error', new Error('Deepgram connection failed'));
      session.close();
    });
  });
});
