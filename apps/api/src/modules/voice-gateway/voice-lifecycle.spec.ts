import { VoiceStreamingGateway } from './gateways/voice-streaming.gateway';
import { VoiceEventType } from '@ai-interview/contracts';
import { Subject } from 'rxjs';

describe('Voice interview authoritative lifecycle', () => {
  let gateway: any;
  let prisma: any;
  let interviewService: any;
  let client: any;
  let state: any;
  let stt: any;
  beforeEach(() => {
    prisma = {
      interviewSession: { findUnique: jest.fn() },
      voiceTranscript: { create: jest.fn().mockResolvedValue({}) },
      voiceSession: { update: jest.fn().mockResolvedValue({}) },
    };
    interviewService = { submitAnswer: jest.fn().mockResolvedValue({}) };
    stt = { createSttStream: jest.fn() };
    gateway = new VoiceStreamingGateway(
      prisma,
      {} as any,
      {} as any,
      stt,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      interviewService,
    );
    client = { readyState: 1, send: jest.fn(), close: jest.fn() };
    state = {
      interviewId: 'interview',
      userId: 'user',
      voiceSessionId: 'voice',
      currentTurn: 1,
      startedAt: new Date(),
      audioBytesReceived: 100,
      bargeInCount: 0,
    };
    jest.spyOn(gateway, 'streamAiVoiceResponse').mockResolvedValue(undefined);
  });
  it('keeps recognition as a draft and waits for an authoritative worker question', async () => {
    prisma.interviewSession.findUnique.mockResolvedValue({
      state: 'ACTIVE',
      currentTurn: 1,
      turns: [{ id: 'turn1', turnNumber: 1, question: { content: 'Actual question 1' } }],
    });
    state.recordingId = 'recording1';
    await Promise.all([
      gateway.handleCandidateFinalTranscript(client, state, 'A complete answer'),
      gateway.handleCandidateFinalTranscript(client, state, 'Duplicate event'),
    ]);
    expect(interviewService.submitAnswer).not.toHaveBeenCalled();
    expect(state.currentTurn).toBe(1);
    expect(prisma.voiceTranscript.create).not.toHaveBeenCalled();
    expect(state.recordingText).toBe('A complete answer Duplicate event');
    expect(gateway.streamAiVoiceResponse).not.toHaveBeenCalled();
    prisma.interviewSession.findUnique.mockResolvedValue({
      state: 'ACTIVE',
      currentTurn: 2,
      turns: [{ id: 'turn2', turnNumber: 2, question: { content: 'Worker-generated question 2' } }],
    });
    await gateway.syncInterviewTurn(client, state);
    await gateway.syncInterviewTurn(client, state);
    expect(gateway.streamAiVoiceResponse).toHaveBeenCalledTimes(1);
    expect(gateway.streamAiVoiceResponse).toHaveBeenCalledWith(
      client,
      state,
      'Worker-generated question 2',
    );
  });
  it('never invents a question while evaluation is in progress', async () => {
    prisma.interviewSession.findUnique.mockResolvedValue({
      state: 'EVALUATING',
      currentTurn: 1,
      turns: [{ id: 'turn1', turnNumber: 1, answer: { id: 'answer' } }],
    });
    await gateway.handleCandidateFinalTranscript(client, state, 'Late STT event');
    await gateway.syncInterviewTurn(client, state);
    expect(interviewService.submitAnswer).not.toHaveBeenCalled();
    expect(gateway.streamAiVoiceResponse).not.toHaveBeenCalled();
  });
  it('preserves the final recording text without submitting or advancing', async () => {
    prisma.interviewSession.findUnique.mockResolvedValue({
      state: 'ACTIVE',
      turns: [{ id: 'turn1', question: {} }],
    });
    interviewService.submitAnswer.mockRejectedValue(new Error('Queue unavailable'));
    state.recordingId = 'recording1';
    await gateway.handleCandidateFinalTranscript(client, state, 'Preserve this answer');
    expect(client.send).toHaveBeenCalledWith(
      expect.stringContaining('"text":"Preserve this answer"'),
    );
    expect(state.currentTurn).toBe(1);
  });
  it('announces actual completion and finalizes once across duplicate close events', async () => {
    gateway.activeClients.set(client, state);
    prisma.interviewSession.findUnique.mockResolvedValue({ state: 'COMPLETED', turns: [] });
    await gateway.syncInterviewTurn(client, state);
    await gateway.handleDisconnect(client);
    expect(prisma.voiceSession.update).toHaveBeenCalledTimes(1);
    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({ type: VoiceEventType.DISCONNECT, state: 'COMPLETED' }),
    );
    expect(client.close).toHaveBeenCalled();
  });
  it('collects multiple utterances and flushes the tail on stop without submitting', async () => {
    const events = new Subject<any>();
    const stream = {
      events,
      close: jest.fn(),
      finish: jest.fn(async () => {
        events.next({ text: 'phần cuối', isFinal: true });
      }),
    };
    stt.createSttStream.mockReturnValue(stream);
    prisma.interviewSession.findUnique.mockResolvedValue({
      state: 'ACTIVE',
      currentTurn: 1,
      turns: [{ id: 'turn1', turnNumber: 1, question: { content: 'Question' } }],
    });
    await gateway.startRecording(client, state, { turnId: 'turn1', recordingId: 'record1' });
    events.next({ text: 'Phần một.', isFinal: true });
    events.next({ text: 'phần cu', isFinal: false });
    await gateway.stopRecording(client, state, { recordingId: 'record1' });
    expect(stream.finish).toHaveBeenCalledTimes(1);
    expect(client.send).toHaveBeenCalledWith(
      expect.stringContaining('"text":"Phần một. phần cuối"'),
    );
    expect(interviewService.submitAnswer).not.toHaveBeenCalled();
    expect(state.recordingId).toBeUndefined();
    client.send.mockClear();
    events.next({ text: 'late old recording', isFinal: true });
    expect(client.send).not.toHaveBeenCalled();
  });
  it('rejects recording against an old turn before opening recognition', async () => {
    prisma.interviewSession.findUnique.mockResolvedValue({
      state: 'ACTIVE',
      currentTurn: 2,
      turns: [{ id: 'turn1', turnNumber: 1, question: {} }],
    });
    await gateway.startRecording(client, state, { turnId: 'turn1', recordingId: 'record1' });
    expect(stt.createSttStream).not.toHaveBeenCalled();
    expect(client.send).toHaveBeenCalledWith(expect.stringContaining('voice:recording-error'));
  });
  it('isolates a synchronous TTS initialization failure from the interview connection', async () => {
    gateway.streamAiVoiceResponse.mockRestore();
    gateway.elevenLabsTts = {
      createStreamingSession: jest.fn(() => {
        throw new Error('Unavailable voice');
      }),
    };
    await gateway.streamAiVoiceResponse(client, state, 'Actual question');
    expect(client.send).toHaveBeenCalledWith(expect.stringContaining('voice:playback-error'));
    expect(client.close).not.toHaveBeenCalled();
    expect(state.isAiSpeaking).toBe(false);
    expect(interviewService.submitAnswer).not.toHaveBeenCalled();
  });
});
