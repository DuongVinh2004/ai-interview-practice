import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { Subject, Observable, filter, map, merge, interval } from 'rxjs';
import { SseEventType } from '@ai-interview/contracts';
import { RedisService } from '../redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

export interface SseSessionEvent {
  sessionId: string;
  type: SseEventType;
  data: unknown;
  timestamp: string;
  sourceInstanceId?: string;
}

const REDIS_SSE_CHANNEL = 'sse:session:events';

@Injectable()
export class SseService implements OnModuleInit {
  private readonly logger = new Logger(SseService.name);
  private readonly eventSubject = new Subject<SseSessionEvent>();
  private readonly instanceId = uuidv4();

  constructor(@Optional() private readonly redisService?: RedisService) {}

  onModuleInit() {
    if (this.redisService) {
      try {
        const subscriber = this.redisService.getSubscriber();
        if (subscriber) {
          subscriber.subscribe(REDIS_SSE_CHANNEL, err => {
            if (err) {
              this.logger.warn(`Failed to subscribe to Redis SSE channel: ${err.message}`);
            } else {
              this.logger.log(
                `Subscribed to cross-process Redis SSE channel: ${REDIS_SSE_CHANNEL}`,
              );
            }
          });

          subscriber.on('message', (channel, message) => {
            if (channel === REDIS_SSE_CHANNEL) {
              try {
                const event: SseSessionEvent = JSON.parse(message);
                // Only process events from other instances to avoid local duplication
                if (event.sourceInstanceId !== this.instanceId) {
                  this.eventSubject.next(event);
                }
              } catch (err: any) {
                this.logger.error(`Error processing Redis SSE event: ${err.message}`);
              }
            }
          });
        }
      } catch (err: any) {
        this.logger.warn(`Redis subscriber initialization skipped: ${err.message}`);
      }
    }
  }

  emitSessionEvent(sessionId: string, type: SseEventType, data: unknown) {
    this.logger.debug(`Emitting SSE event [${type}] for session ${sessionId}`);
    const event: SseSessionEvent = {
      sessionId,
      type,
      data,
      timestamp: new Date().toISOString(),
      sourceInstanceId: this.instanceId,
    };

    // 1. Emit locally for clients connected to this instance
    this.eventSubject.next(event);

    // 2. Publish to Redis for cross-process fanout across API and Worker replicas (REL-002)
    if (this.redisService) {
      this.redisService.publish(REDIS_SSE_CHANNEL, event).catch(err => {
        this.logger.warn(`Failed to publish SSE event to Redis: ${err.message}`);
      });
    }
  }

  getSessionEventStream(sessionId: string): Observable<{ data: SseSessionEvent }> {
    const sessionStream = this.eventSubject.asObservable().pipe(
      filter(event => event.sessionId === sessionId),
      map(event => ({ data: event })),
    );

    // Heartbeat every 15 seconds
    const heartbeatStream = interval(15000).pipe(
      map(() => ({
        data: {
          sessionId,
          type: SseEventType.HEARTBEAT,
          data: { ping: true },
          timestamp: new Date().toISOString(),
        },
      })),
    );

    return merge(sessionStream, heartbeatStream);
  }
}
