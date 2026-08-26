import { Test, TestingModule } from '@nestjs/testing';
import { SseService } from './sse.service';
import { RedisService } from '../redis/redis.service';
import { SseEventType } from '@ai-interview/contracts';
import { firstValueFrom, take } from 'rxjs';

describe('SseService (REL-002 Cross-process SSE)', () => {
  let service: SseService;
  let mockRedis: any;
  let mockSubscriber: any;
  let messageCallback: ((channel: string, message: string) => void) | null = null;

  beforeEach(async () => {
    messageCallback = null;
    mockSubscriber = {
      subscribe: jest.fn((channel, cb) => cb && cb(null)),
      on: jest.fn((event, cb) => {
        if (event === 'message') {
          messageCallback = cb;
        }
      }),
    };

    mockRedis = {
      getSubscriber: jest.fn(() => mockSubscriber),
      publish: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SseService,
        {
          provide: RedisService,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<SseService>(SseService);
    service.onModuleInit();
  });

  it('subscribes to the Redis SSE channel on initialization', () => {
    expect(mockRedis.getSubscriber).toHaveBeenCalled();
    expect(mockSubscriber.subscribe).toHaveBeenCalledWith(
      'sse:session:events',
      expect.any(Function),
    );
  });

  it('emits local session events and publishes to Redis for other replicas', async () => {
    const sessionId = 'session-123';
    const stream$ = service.getSessionEventStream(sessionId);

    const eventPromise = firstValueFrom(stream$.pipe(take(1)));

    service.emitSessionEvent(sessionId, SseEventType.EVALUATION_COMPLETED, { score: 9.5 });

    const event = await eventPromise;
    expect(event.data.sessionId).toBe(sessionId);
    expect(event.data.type).toBe(SseEventType.EVALUATION_COMPLETED);
    expect(event.data.data).toEqual({ score: 9.5 });

    expect(mockRedis.publish).toHaveBeenCalledWith(
      'sse:session:events',
      expect.objectContaining({
        sessionId,
        type: SseEventType.EVALUATION_COMPLETED,
      }),
    );
  });

  it('receives incoming events from another worker/replica via Redis and delivers to stream', async () => {
    const sessionId = 'session-cross-process';
    const stream$ = service.getSessionEventStream(sessionId);

    const eventPromise = firstValueFrom(stream$.pipe(take(1)));

    // Simulate incoming message from Redis from another process
    expect(messageCallback).toBeDefined();
    messageCallback!(
      'sse:session:events',
      JSON.stringify({
        sessionId,
        type: SseEventType.QUESTION_READY,
        data: { question: 'Explain CAP theorem' },
        timestamp: new Date().toISOString(),
        sourceInstanceId: 'different-instance-id',
      }),
    );

    const event = await eventPromise;
    expect(event.data.sessionId).toBe(sessionId);
    expect(event.data.type).toBe(SseEventType.QUESTION_READY);
    expect((event.data.data as any).question).toBe('Explain CAP theorem');
  });

  it('ignores incoming Redis messages originating from the same instance (deduplication)', done => {
    const sessionId = 'session-dedup';
    const stream$ = service.getSessionEventStream(sessionId);

    let receivedCount = 0;
    const sub = stream$.subscribe({
      next: event => {
        if (event.data.type === SseEventType.SESSION_UPDATED) {
          receivedCount++;
        }
      },
    });

    // Local emission
    service.emitSessionEvent(sessionId, SseEventType.SESSION_UPDATED, { progress: 50 });

    // Simulate loopback of the same event with our own instanceId from Redis
    const publishedCall = mockRedis.publish.mock.calls[0];
    const publishedPayload = publishedCall[1];

    messageCallback!('sse:session:events', JSON.stringify(publishedPayload));

    setTimeout(() => {
      expect(receivedCount).toBe(1); // Received only once via local emission, loopback skipped
      sub.unsubscribe();
      done();
    }, 50);
  });
});
