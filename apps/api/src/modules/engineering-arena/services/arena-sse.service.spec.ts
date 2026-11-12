import { ArenaSseService, ArenaStreamMessage } from './arena-sse.service';

describe('ArenaSseService', () => {
  let service: ArenaSseService;

  beforeEach(() => {
    service = new ArenaSseService();
  });

  it('delivers real-time streamed logs to subscribers for the targeted session', done => {
    const targetSessionId = 'session-123';
    const otherSessionId = 'session-456';
    const received: ArenaStreamMessage[] = [];

    const subscription = service.getSessionStream(targetSessionId).subscribe({
      next: ({ data }) => {
        received.push(data);
        if (received.length === 2) {
          expect(received[0].sessionId).toBe(targetSessionId);
          expect(received[0].type).toBe('status');
          expect(received[0].payload).toBe('Starting test...');

          expect(received[1].sessionId).toBe(targetSessionId);
          expect(received[1].type).toBe('stdout');
          expect(received[1].payload).toBe('PASS index.spec.ts');

          subscription.unsubscribe();
          done();
        }
      },
    });

    // Other session should be filtered out
    service.emitLog(otherSessionId, 'stdout', 'Should not be seen by target session');

    // Target session messages
    service.emitLog(targetSessionId, 'status', 'Starting test...');
    service.emitLog(targetSessionId, 'stdout', 'PASS index.spec.ts');
  });

  it('buffers recent execution logs for reconnecting clients', () => {
    const sessionId = 'session-buffer-1';

    service.emitLog(sessionId, 'status', 'Step 1');
    service.emitLog(sessionId, 'stdout', 'Output 1');
    service.emitLog(sessionId, 'stderr', 'Warning 1');

    const recent = service.getRecentLogs(sessionId);
    expect(recent).toHaveLength(3);
    expect(recent[0].payload).toBe('Step 1');
    expect(recent[1].payload).toBe('Output 1');
    expect(recent[2].payload).toBe('Warning 1');
  });

  it('clears session buffer on workspace termination', () => {
    const sessionId = 'session-cleanup';
    service.emitLog(sessionId, 'stdout', 'Hello');
    expect(service.getRecentLogs(sessionId)).toHaveLength(1);

    service.clearSession(sessionId);
    expect(service.getRecentLogs(sessionId)).toHaveLength(0);
  });

  it('enforces backpressure cap by FIFO evicting excess logs under heavy burst', () => {
    const sessionId = 'session-burst';
    for (let i = 0; i < 150; i++) {
      service.emitLog(sessionId, 'stdout', `Log chunk ${i}`);
    }

    const recent = service.getRecentLogs(sessionId);
    expect(recent.length).toBe(100); // MAX_BUFFER_PER_SESSION = 100
    expect(recent[0].payload).toBe('Log chunk 50');
    expect(recent[99].payload).toBe('Log chunk 149');
  });

  it('flushes and drains session buffer on demand', () => {
    const sessionId = 'session-flush';
    service.emitLog(sessionId, 'stdout', 'Line 1');
    service.emitLog(sessionId, 'stdout', 'Line 2');

    const flushed = service.flushBuffer(sessionId);
    expect(flushed).toHaveLength(2);
    expect(flushed[0].payload).toBe('Line 1');
    expect(flushed[1].payload).toBe('Line 2');

    expect(service.getRecentLogs(sessionId)).toHaveLength(0);
  });

  it('finalizes session execution and flushes buffer with completeSession', () => {
    const sessionId = 'session-complete';
    service.emitLog(sessionId, 'stdout', 'Pre-final log');

    const flushed = service.completeSession(sessionId, 0);
    expect(flushed.length).toBeGreaterThanOrEqual(1);
    expect(flushed.some(m => m.payload.includes('Session execution finalized'))).toBe(true);
    expect(service.getRecentLogs(sessionId)).toHaveLength(0);
  });
});
