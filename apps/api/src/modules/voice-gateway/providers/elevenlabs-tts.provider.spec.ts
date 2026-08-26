import { Test, TestingModule } from '@nestjs/testing';
import { ElevenLabsTtsProvider } from './elevenlabs-tts.provider';
import { ConfigService } from '@nestjs/config';

describe('ElevenLabsTtsProvider (Module B3)', () => {
  let provider: ElevenLabsTtsProvider;

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'voice.elevenlabsApiKey') return 'mock-key';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ElevenLabsTtsProvider, { provide: ConfigService, useValue: mockConfig }],
    }).compile();

    provider = module.get<ElevenLabsTtsProvider>(ElevenLabsTtsProvider);
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
});
