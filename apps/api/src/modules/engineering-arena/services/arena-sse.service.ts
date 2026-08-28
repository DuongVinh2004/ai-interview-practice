import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface ArenaStreamMessage {
  sessionId: string;
  type: 'stdout' | 'stderr' | 'status' | 'test_result' | 'heartbeat';
  payload: string;
  timestamp: string;
}

@Injectable()
export class ArenaSseService {
  private readonly logger = new Logger(ArenaSseService.name);
  private readonly eventSubject = new Subject<ArenaStreamMessage>();

  emitLog(
    sessionId: string,
    type: 'stdout' | 'stderr' | 'status' | 'test_result',
    payload: string,
  ): void {
    this.eventSubject.next({
      sessionId,
      type,
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  getSessionStream(sessionId: string): Observable<{ data: ArenaStreamMessage }> {
    this.logger.log(`Client subscribed to Arena SSE stream for session ${sessionId}`);
    return this.eventSubject.asObservable().pipe(
      filter(msg => msg.sessionId === sessionId),
      map(msg => ({ data: msg })),
    );
  }
}
