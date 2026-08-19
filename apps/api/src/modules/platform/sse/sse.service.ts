import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable, filter, map, merge, interval } from 'rxjs';
import { SseEventType } from '@ai-interview/contracts';

export interface SseSessionEvent {
  sessionId: string;
  type: SseEventType;
  data: unknown;
  timestamp: string;
}

@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);
  private readonly eventSubject = new Subject<SseSessionEvent>();

  emitSessionEvent(sessionId: string, type: SseEventType, data: unknown) {
    this.logger.debug(`Emitting SSE event [${type}] for session ${sessionId}`);
    this.eventSubject.next({
      sessionId,
      type,
      data,
      timestamp: new Date().toISOString(),
    });
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
