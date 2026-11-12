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
  private readonly messageBuffer = new Map<string, ArenaStreamMessage[]>();
  private readonly MAX_BUFFER_PER_SESSION = 100;

  emitLog(
    sessionId: string,
    type: 'stdout' | 'stderr' | 'status' | 'test_result' | 'heartbeat',
    payload: string,
  ): void {
    const message: ArenaStreamMessage = {
      sessionId,
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    // Buffer message for reconnecting clients with bounded backpressure cap
    const buffer = this.messageBuffer.get(sessionId) || [];
    buffer.push(message);
    if (buffer.length > this.MAX_BUFFER_PER_SESSION) {
      // FIFO eviction to avoid unconstrained process memory growth under heavy log bursts
      buffer.shift();
    }
    this.messageBuffer.set(sessionId, buffer);

    this.eventSubject.next(message);
  }

  getSessionStream(sessionId: string): Observable<{ data: ArenaStreamMessage }> {
    this.logger.log(`Client subscribed to Arena SSE stream for session ${sessionId}`);
    return this.eventSubject.asObservable().pipe(
      filter(msg => msg.sessionId === sessionId),
      map(msg => ({ data: msg })),
    );
  }

  getRecentLogs(sessionId: string): ArenaStreamMessage[] {
    return [...(this.messageBuffer.get(sessionId) || [])];
  }

  /**
   * Flushes and drains all accumulated buffer logs for the given session
   */
  flushBuffer(sessionId: string): ArenaStreamMessage[] {
    const logs = [...(this.messageBuffer.get(sessionId) || [])];
    this.messageBuffer.set(sessionId, []);
    return logs;
  }

  /**
   * Completes a session stream with terminal status event and flushes buffer
   */
  completeSession(sessionId: string, exitCode?: number): ArenaStreamMessage[] {
    this.emitLog(sessionId, 'status', `Session execution finalized (exitCode: ${exitCode ?? 0})`);
    return this.flushBuffer(sessionId);
  }

  clearSession(sessionId: string): void {
    this.messageBuffer.delete(sessionId);
    this.logger.log(`Cleared Arena SSE buffer for session ${sessionId}`);
  }
}
