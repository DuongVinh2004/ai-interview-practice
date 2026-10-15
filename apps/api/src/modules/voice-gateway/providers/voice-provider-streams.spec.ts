import WebSocket from 'ws';
import { DeepgramSttProvider } from './deepgram-stt.provider';
import { ElevenLabsTtsProvider } from './elevenlabs-tts.provider';

jest.mock('ws', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('events');
  class Socket extends EventEmitter {
    static OPEN = 1;
    static CONNECTING = 0;
    static instances: any[] = [];
    readyState = 0;
    send = jest.fn();
    close = jest.fn(() => {
      this.readyState = 3;
    });
    constructor(public url: string) {
      super();
      Socket.instances.push(this);
    }
  }
  return { __esModule: true, default: Socket };
});

describe('Voice provider wire protocol', () => {
  const config = (overrides: Record<string, unknown> = {}) => ({
    get: (key: string) =>
      ({
        'voice.deepgramApiKey': 'mock-key',
        'voice.elevenlabsApiKey': 'mock-key',
        ...overrides,
      })[key],
  });
  beforeEach(() => {
    (WebSocket as any).instances = [];
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('synthesizes complete Vietnamese questions through the configured router across three sessions', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(
      async () =>
        new Response(new Uint8Array([255, 243, 72, 0]), {
          headers: { 'content-type': 'audio/mp3' },
        }),
    );
    const provider = new ElevenLabsTtsProvider(
      config({
        'ai.ninerouterKey': 'test-router-key',
        'ai.ninerouterUrl': 'http://localhost:20128',
      }) as any,
    );
    for (let attempt = 0; attempt < 3; attempt++) {
      const session = provider.createStreamingSession(undefined, 'vi');
      const chunks: Buffer[] = [];
      const completed = new Promise<void>((resolve, reject) =>
        session.audioStream.subscribe({
          next: chunk => chunks.push(chunk),
          complete: resolve,
          error: reject,
        }),
      );
      session.sendText('Xin chào.');
      session.sendText('Hãy giới thiệu bản thân.');
      session.flush();
      session.flush();
      await completed;
      expect(session.codec).toBe('mp3');
      expect(chunks).toHaveLength(1);
      session.close();
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).input).toBe(
      'Xin chào. Hãy giới thiệu bản thân.',
    );
    expect((WebSocket as any).instances).toHaveLength(0);
  });
  it('aggregates final STT segments until end of utterance, including an empty endpoint', () => {
    const provider = new DeepgramSttProvider(
      config({ 'voice.deepgramApiKey': 'test-stt-key' }) as any,
    );
    const session = provider.createSttStream();
    const events: any[] = [];
    session.events.subscribe(event => events.push(event));
    const socket = (WebSocket as any).instances[0];
    const emit = (text: string, is_final: boolean, speech_final: boolean) =>
      socket.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            is_final,
            speech_final,
            channel: { alternatives: [{ transcript: text }] },
          }),
        ),
      );
    emit('First sentence.', true, false);
    emit('Second sentence.', true, false);
    expect(events.every(e => !e.isFinal)).toBe(true);
    emit('', true, true);
    expect(events.at(-1)).toEqual(
      expect.objectContaining({ text: 'First sentence. Second sentence.', isFinal: true }),
    );
    emit('New answer.', true, true);
    expect(events.at(-1).text).toBe('New answer.');
    session.close();
  });
  it('reports STT provider errors to the gateway', () => {
    const provider = new DeepgramSttProvider(
      config({ 'voice.deepgramApiKey': 'test-stt-key' }) as any,
    );
    const session = provider.createSttStream();
    const error = jest.fn();
    session.events.subscribe({ error });
    (WebSocket as any).instances[0].emit('error', new Error('Offline'));
    expect(error).toHaveBeenCalled();
    session.close();
  });
  it('waits for CloseStream metadata and emits the unclosed final segment before resolving', async () => {
    const provider = new DeepgramSttProvider(
      config({ 'voice.deepgramApiKey': 'test-stt-key' }) as any,
    );
    const session = provider.createSttStream();
    const socket = (WebSocket as any).instances[0];
    const received: any[] = [];
    session.events.subscribe(event => received.push(event));
    socket.readyState = 1;
    socket.emit('open');
    const done = session.finish!();
    expect(socket.send).toHaveBeenLastCalledWith(JSON.stringify({ type: 'CloseStream' }));
    socket.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          is_final: true,
          speech_final: false,
          channel: { alternatives: [{ transcript: 'last words' }] },
        }),
      ),
    );
    socket.emit('message', Buffer.from(JSON.stringify({ type: 'Metadata' })));
    await done;
    expect(received.at(-1)).toEqual({ text: 'last words', isFinal: true });
    session.close();
  });
  it('flushes text queued before the ElevenLabs connection opens at 24 kHz', () => {
    const provider = new ElevenLabsTtsProvider(
      config({ 'voice.elevenlabsApiKey': 'test-tts-key' }) as any,
    );
    const session = provider.createStreamingSession();
    const complete = jest.fn();
    session.audioStream.subscribe({ complete });
    session.sendText('Question one.');
    session.flush();
    const socket = (WebSocket as any).instances[0];
    expect(socket.url).toContain('output_format=pcm_24000');
    socket.readyState = 1;
    socket.emit('open');
    expect(socket.send).toHaveBeenLastCalledWith(JSON.stringify({ text: '' }));
    socket.emit('message', Buffer.from(JSON.stringify({ isFinal: true })));
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it('never silently replaces a failed paid voice with mock tones', () => {
    const provider = new ElevenLabsTtsProvider(
      config({ 'voice.elevenlabsApiKey': 'test-tts-key' }) as any,
    );
    const session = provider.createStreamingSession();
    const error = jest.fn();
    session.audioStream.subscribe({ error });
    session.sendText('Question');
    (WebSocket as any).instances[0].emit('error', new Error('Unauthorized'));
    expect(error).toHaveBeenCalled();
  });
  it('selects multilingual ElevenLabs for Vietnamese even when Deepgram is preferred', () => {
    const provider = new ElevenLabsTtsProvider(
      config({
        'voice.elevenlabsApiKey': 'test-tts-key',
        'voice.deepgramApiKey': 'test-stt-key',
        'voice.ttsProvider': 'deepgram',
      }) as any,
    );
    const session = provider.createStreamingSession(undefined, 'vi');
    expect((WebSocket as any).instances[0].url).toContain('elevenlabs');
    session.close();
  });
});
