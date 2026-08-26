import { Test, TestingModule } from '@nestjs/testing';
import { DeepgramSttProvider } from './deepgram-stt.provider';
import { ConfigService } from '@nestjs/config';

describe('DeepgramSttProvider (Module B3)', () => {
  let provider: DeepgramSttProvider;

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'voice.deepgramApiKey') return 'mock-key';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeepgramSttProvider, { provide: ConfigService, useValue: mockConfig }],
    }).compile();

    provider = module.get<DeepgramSttProvider>(DeepgramSttProvider);
  });

  it('creates STT stream and receives final transcript on close', done => {
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
