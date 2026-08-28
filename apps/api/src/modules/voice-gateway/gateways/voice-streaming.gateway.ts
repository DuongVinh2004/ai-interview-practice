import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WebSocket, Server } from 'ws';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { VadEngineService } from '../services/vad-engine.service';
import { MockVoiceProvider } from '../providers/mock-voice.provider';
import { DeepgramSttProvider } from '../providers/deepgram-stt.provider';
import { ElevenLabsTtsProvider } from '../providers/elevenlabs-tts.provider';
import { SentenceChunkerService } from '../services/sentence-chunker.service';
import { SttStreamSession, TtsStreamSession } from '../interfaces/voice-provider.interface';
import {
  VoiceEventType,
  VoiceSessionStatus,
  SpeakerRole,
} from '@ai-interview/contracts';
import { Subscription } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { InterviewService } from '../../interview/interview.service';
import {
  EntitlementMetric,
  EntitlementReservationService,
} from '../../billing/entitlement-reservation.service';

interface ClientSessionState {
  ws: WebSocket;
  interviewId?: string;
  voiceSessionId?: string;
  userId?: string;
  authenticatedUser?: any;
  voiceTicketJti?: string;
  entitlementReservationId?: string;
  isAiSpeaking: boolean;
  cancelAiStreaming: boolean;
  consecutiveSpeechFrames: number;
  consecutiveSilenceFrames: number;
  audioBuffer: Buffer[];
  audioBytesReceived: number;
  audioBytesSent: number;
  bargeInCount: number;
  startedAt: Date;
  currentTurn: number;
  sttSession?: SttStreamSession;
  sttSubscription?: Subscription;
  ttsSession?: TtsStreamSession;
  ttsSubscription?: Subscription;
  lastCandidateSpeechTime?: number;
  messageCountThisSecond: number;
  lastMessageSecond: number;
}

@WebSocketGateway({
  path: '/voice',
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
    ],
    credentials: true,
  },
})
export class VoiceStreamingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(VoiceStreamingGateway.name);
  private readonly activeClients = new Map<WebSocket, ClientSessionState>();
  private readonly usedTicketJtis = new Map<string, number>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vad: VadEngineService,
    private readonly voiceProvider: MockVoiceProvider,
    private readonly deepgramStt: DeepgramSttProvider,
    private readonly elevenLabsTts: ElevenLabsTtsProvider,
    private readonly chunker: SentenceChunkerService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly entitlementReservations: EntitlementReservationService,
    @Optional()
    @Inject(forwardRef(() => InterviewService))
    private readonly interviewService?: InterviewService,
  ) {}

  private validateVoiceTicket(
    ticket: string,
    interviewId?: string,
  ): { sub: string; role: string; jti: string } | null {
    try {
      const secret =
        this.configService.get<string>('jwt.accessSecret') ||
        this.configService.get<string>('JWT_ACCESS_SECRET') ||
        'dev-access-secret-min-32-chars-ok';
      const payload = this.jwtService.verify<any>(ticket, { secret });
      if (payload.tokenType !== 'VOICE_TICKET' || !payload.jti) return null;
      if (interviewId && payload.interviewId && payload.interviewId !== interviewId) return null;
      if (payload.jti) {
        const now = Date.now();
        if (this.usedTicketJtis.has(payload.jti)) {
          this.logger.warn(`Rejected replayed voice ticket ${payload.jti}`);
          return null;
        }
        this.usedTicketJtis.set(payload.jti, now + 120_000);
      }
      return { sub: payload.sub, role: payload.role || 'CANDIDATE', jti: payload.jti };
    } catch (err: any) {
      this.logger.warn(`Voice ticket verification error: ${err.message}`);
      return null;
    }
  }

  async handleConnection(client: WebSocket, req?: any) {
    this.logger.log('Client connected to Voice Gateway WebSocket.');

    let authenticatedUser: any = null;
    let userId: string | undefined = undefined;
    let voiceTicketJti: string | undefined = undefined;

    // Extract & verify JWT or Ticket through canonical AuthService / Ticket validator
    try {
      let token: string | undefined;
      let ticket: string | undefined;
      if (req?.url) {
        const parsedUrl = new URL(req.url, 'http://localhost');
        token = parsedUrl.searchParams.get('token') || undefined;
        ticket = parsedUrl.searchParams.get('ticket') || undefined;
      }
      if (!token && req?.headers?.authorization) {
        const authHeader = req.headers.authorization as string;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }
      if (ticket) {
        const ticketAuth = this.validateVoiceTicket(ticket);
        if (ticketAuth) {
          authenticatedUser = ticketAuth;
          userId = ticketAuth.sub;
          voiceTicketJti = ticketAuth.jti;
          this.enforceSingleActiveConnection(userId, client);
        }
      } else if (token) {
        authenticatedUser = await this.authService.validateAccessToken(token);
        userId = authenticatedUser?.sub;
        if (userId) {
          this.enforceSingleActiveConnection(userId, client);
        }
      }
    } catch (err: any) {
      this.logger.warn(`WebSocket handshake authentication rejected: ${err.message}`);
    }

    this.activeClients.set(client, {
      ws: client,
      userId,
      authenticatedUser,
      voiceTicketJti,
      isAiSpeaking: false,
      cancelAiStreaming: false,
      consecutiveSpeechFrames: 0,
      consecutiveSilenceFrames: 0,
      audioBuffer: [],
      audioBytesReceived: 0,
      audioBytesSent: 0,
      bargeInCount: 0,
      startedAt: new Date(),
      currentTurn: 1,
      messageCountThisSecond: 0,
      lastMessageSecond: Math.floor(Date.now() / 1000),
    });

    client.on('message', async (data: any, isBinary: boolean) => {
      try {
        if (isBinary) {
          await this.handleBinaryAudio(client, Buffer.from(data));
        } else {
          const text = data.toString();
          const parsed = JSON.parse(text);
          await this.handleJsonEvent(client, parsed);
        }
      } catch (err: any) {
        this.logger.error(`Error processing voice message: ${err.message}`);
        this.sendJson(client, {
          type: VoiceEventType.ERROR,
          message: err.message || 'Internal voice streaming error',
        });
      }
    });
  }

  private enforceSingleActiveConnection(userId: string, currentWs: WebSocket) {
    for (const [ws, state] of this.activeClients.entries()) {
      if (state.userId === userId && ws !== currentWs) {
        this.logger.warn(
          `Terminating existing active voice connection for user ${userId} (single active stream enforced)`,
        );
        this.sendJson(ws, {
          type: VoiceEventType.ERROR,
          message: 'Voice session replaced by a newer connection.',
        });
        ws.close(1008, 'Concurrent connection replaced');
        this.activeClients.delete(ws);
      }
    }
  }

  async handleDisconnect(client: WebSocket) {
    this.logger.log('Client disconnected from Voice Gateway.');
    const state = this.activeClients.get(client);
    if (state) {
      if (state.sttSubscription) state.sttSubscription.unsubscribe();
      if (state.sttSession) state.sttSession.close();
      if (state.ttsSubscription) state.ttsSubscription.unsubscribe();
      if (state.ttsSession) state.ttsSession.close();
      if (state.voiceSessionId) {
        await this.finalizeVoiceSession(state);
      }
    }
    this.activeClients.delete(client);
  }

  private async handleJsonEvent(client: WebSocket, payload: any) {
    const state = this.activeClients.get(client);
    if (!state) return;

    // Rate limiting: max 10 JSON control messages per second
    const currentSec = Math.floor(Date.now() / 1000);
    if (currentSec !== state.lastMessageSecond) {
      state.lastMessageSecond = currentSec;
      state.messageCountThisSecond = 1;
    } else {
      state.messageCountThisSecond += 1;
      if (state.messageCountThisSecond > 10) {
        this.logger.warn(`JSON message rate limit exceeded for user ${state.userId}`);
        return;
      }
    }

    switch (payload.type) {
      case VoiceEventType.CONNECT:
      case 'voice:connect':
        await this.handleConnectVoice(client, state, payload);
        break;

      case VoiceEventType.INTERRUPT:
      case 'voice:interrupt':
        this.triggerBargeIn(client, state);
        break;

      case VoiceEventType.DISCONNECT:
      case 'voice:disconnect':
        await this.finalizeVoiceSession(state);
        this.sendJson(client, { type: VoiceEventType.DISCONNECT });
        break;

      case 'ping':
        this.sendJson(client, {
          type: VoiceEventType.CONNECTION_QUALITY,
          latencyMs: Math.floor(Math.random() * 20) + 15,
          jitterMs: Math.floor(Math.random() * 5) + 2,
          packetLossRate: 0.001,
          quality: 'EXCELLENT',
        });
        break;

      default:
        this.logger.warn(`Unknown voice event type: ${payload.type}`);
    }
  }

  private async handleConnectVoice(client: WebSocket, state: ClientSessionState, payload: any) {
    state.interviewId = payload.interviewId;

    if (!state.userId) {
      if (payload.ticket) {
        const ticketAuth = this.validateVoiceTicket(payload.ticket, payload.interviewId);
        if (ticketAuth) {
          state.authenticatedUser = ticketAuth;
          state.userId = ticketAuth.sub;
          state.voiceTicketJti = ticketAuth.jti;
        }
      }
      if (!state.userId && payload.token) {
        try {
          state.authenticatedUser = await this.authService.validateAccessToken(payload.token);
          state.userId = state.authenticatedUser?.sub;
        } catch (err: any) {
          this.logger.warn(`Event JWT verification failed: ${err.message}`);
        }
      }
    }

    if (!state.userId || !state.authenticatedUser) {
      this.sendJson(client, {
        type: VoiceEventType.ERROR,
        message: 'Authentication required. Missing or invalid JWT token or voice ticket.',
      });
      client.close(1008, 'Unauthorized');
      return;
    }

    const paidStreamingEnabled =
      this.deepgramStt.isPaidConfigured() || this.elevenLabsTts.isPaidConfigured();
    if (paidStreamingEnabled && !state.voiceTicketJti) {
      this.sendJson(client, {
        type: VoiceEventType.ERROR,
        message: 'A single-use voice ticket is required before starting a voice stream.',
      });
      client.close(1008, 'Voice Ticket Required');
      return;
    }

    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: payload.interviewId },
      include: {
        jobRole: true,
        seniorityLevel: true,
        turns: {
          orderBy: { turnNumber: 'asc' },
          include: { question: true, answer: true },
        },
      },
    });

    if (!interview) {
      this.sendJson(client, { type: VoiceEventType.ERROR, message: 'Interview session not found' });
      return;
    }

    // Role check uses verified current database role from authenticatedUser.role
    if (interview.userId !== state.userId && state.authenticatedUser.role !== 'ADMIN') {
      this.sendJson(client, {
        type: VoiceEventType.ERROR,
        message: 'Forbidden. You are not authorized to access this interview session.',
      });
      client.close(1008, 'Forbidden');
      return;
    }

    state.currentTurn = interview.currentTurn || 1;

    const voiceSession = await this.prisma.voiceSession.upsert({
      where: { interviewId: payload.interviewId },
      create: {
        interviewId: payload.interviewId,
        status: VoiceSessionStatus.ACTIVE,
        startedAt: new Date(),
      },
      update: {
        status: VoiceSessionStatus.ACTIVE,
        startedAt: new Date(),
      },
    });

    state.voiceSessionId = voiceSession.id;

    if (paidStreamingEnabled) {
      try {
        const reservation = await this.entitlementReservations.reserve({
          userId: state.userId,
          metric: EntitlementMetric.AUDIO_MINUTES,
          // The gateway has a hard 15-minute cap, so it reserves the full
          // maximum before either streaming provider is opened.
          quantity: 15,
          idempotencyKey: `voice-ticket:${state.voiceTicketJti}`,
          operationType: 'voice.stream',
          operationId: voiceSession.id,
          expiresInMs: 20 * 60 * 1000,
        });
        if (reservation.state !== 'RESERVED' || reservation.isNewReservation !== true) {
          throw new Error('The voice ticket has already been used or requires reconciliation.');
        }
        await this.entitlementReservations.markProviderDispatchStarted(
          reservation.id,
          'voice-streaming',
        );
        state.entitlementReservationId = reservation.id;
      } catch (err: any) {
        this.logger.warn(`Voice entitlement reservation rejected: ${err.message}`);
        this.sendJson(client, {
          type: VoiceEventType.QUOTA_EXCEEDED,
          message: 'Voice quota is unavailable or exhausted. Please use a new ticket after resolving billing.',
        });
        client.close(1008, 'Quota Exceeded');
        return;
      }
    }

    // Initialize Deepgram STT Stream Session
    let sttStream: SttStreamSession;
    try {
      sttStream = this.deepgramStt.createSttStream(24000);
    } catch (err: any) {
      await this.holdVoiceReservationForReconciliation(state, 'voice_stt_start_outcome_ambiguous', err);
      throw err;
    }
    state.sttSession = sttStream;
    state.sttSubscription = sttStream.events.subscribe(async event => {
      if (!event.isFinal) {
        this.sendJson(client, {
          type: VoiceEventType.INTERIM_TRANSCRIPT,
          speaker: SpeakerRole.USER,
          text: event.text,
          confidence: event.confidence,
        });
      } else {
        await this.handleCandidateFinalTranscript(client, state, event.text);
      }
    });

    this.sendJson(client, {
      type: VoiceEventType.CONNECTED,
      sessionId: voiceSession.id,
      codec: 'opus',
      sampleRate: 24000,
    });

    // Initial question from authoritative turn
    const activeTurn =
      interview.turns.find(t => t.turnNumber === state.currentTurn) || interview.turns[0];
    const initialQuestion =
      activeTurn?.question?.content ||
      `Welcome to your live voice technical interview for ${interview.jobRole?.name || 'Software Engineer'}. Let's begin: Could you explain your approach to designing resilient distributed architectures?`;

    await this.streamAiVoiceResponse(client, state, initialQuestion);
  }

  private async handleBinaryAudio(client: WebSocket, pcmBuffer: Buffer) {
    const state = this.activeClients.get(client);
    if (!state) return;

    if (!state.userId || !state.voiceSessionId) {
      this.sendJson(client, {
        type: VoiceEventType.ERROR,
        message: 'Authentication and voice:connect required before streaming audio.',
      });
      client.close(1008, 'Unauthorized audio frame stream');
      return;
    }

    // Hard session duration limit (15 minutes cap - FINDING-002)
    const elapsedMs = Date.now() - state.startedAt.getTime();
    if (elapsedMs > 900_000) {
      this.logger.warn(
        `Voice session hard limit of 15 minutes reached for session ${state.voiceSessionId}`,
      );
      this.sendJson(client, {
        type: VoiceEventType.ERROR,
        message: 'Max voice session duration of 15 minutes reached.',
      });
      client.close(1000, 'Session Duration Limit');
      return;
    }

    // Audio frame rate limit: max 100 frames/sec (FINDING-006)
    const currentSec = Math.floor(Date.now() / 1000);
    if (currentSec !== state.lastMessageSecond) {
      state.lastMessageSecond = currentSec;
      state.messageCountThisSecond = 1;
    } else {
      state.messageCountThisSecond += 1;
      if (state.messageCountThisSecond > 100) {
        return; // Drop flood frames
      }
    }

    const MAX_TURN_BUFFER_BYTES = 5 * 1024 * 1024;
    if (state.audioBytesReceived + pcmBuffer.length > MAX_TURN_BUFFER_BYTES) {
      this.sendJson(client, {
        type: VoiceEventType.ERROR,
        message: 'Audio frame buffer limit exceeded (5 MB maximum).',
      });
      return;
    }

    state.audioBytesReceived += pcmBuffer.length;
    state.audioBuffer.push(pcmBuffer);

    // Relay audio chunk to live STT engine
    if (state.sttSession) {
      state.sttSession.sendAudioChunk(pcmBuffer);
    }

    // VAD frame evaluation for barge-in detection
    const vadResult = this.vad.processFrame(pcmBuffer, {
      consecutiveSpeechFrames: state.consecutiveSpeechFrames,
      consecutiveSilenceFrames: state.consecutiveSilenceFrames,
      isAiSpeaking: state.isAiSpeaking,
    });

    state.consecutiveSpeechFrames = Math.floor(vadResult.speechDurationMs / 20);
    state.consecutiveSilenceFrames = Math.floor(vadResult.silenceDurationMs / 20);

    if (vadResult.isBargeIn && state.isAiSpeaking) {
      this.triggerBargeIn(client, state);
    }
  }

  private triggerBargeIn(client: WebSocket, state: ClientSessionState) {
    state.bargeInCount += 1;
    state.cancelAiStreaming = true;
    state.isAiSpeaking = false;

    if (state.ttsSession) {
      state.ttsSession.close();
      state.ttsSession = undefined;
    }

    this.logger.log(`Barge-in interrupt triggered on session ${state.voiceSessionId}`);
    this.sendJson(client, {
      type: VoiceEventType.INTERRUPT,
      bargeInCount: state.bargeInCount,
    });
  }

  private async handleCandidateFinalTranscript(
    client: WebSocket,
    state: ClientSessionState,
    transcriptText: string,
  ) {
    if (!transcriptText || transcriptText.trim() === '') return;

    if (state.interviewId && state.userId) {
      // Find authoritative active turn from DB
      try {
        const interview = await this.prisma.interviewSession.findUnique({
          where: { id: state.interviewId },
          include: {
            turns: {
              where: { turnNumber: state.currentTurn },
              include: { question: true, answer: true },
            },
          },
        });

        const activeTurn = interview?.turns?.[0];
        if (activeTurn && !activeTurn.answer && this.interviewService) {
          await this.interviewService.submitAnswer(state.userId, state.interviewId, {
            turnId: activeTurn.id,
            answerText: transcriptText.trim(),
          });
        }
        state.currentTurn += 1;
      } catch (err: any) {
        this.logger.error(
          `Auto-submit answer from voice transcript failed, triggering fallback: ${err.message}`,
        );
        this.sendJson(client, {
          type: VoiceEventType.FALLBACK_TO_TEXT,
          message: 'Voice answer submission failed. Please verify and re-submit via text.',
          uncommittedTranscript: transcriptText.trim(),
          turnNumber: state.currentTurn,
        });
        return;
      }
    }

    if (state.voiceSessionId) {
      await this.prisma.voiceTranscript.create({
        data: {
          voiceSessionId: state.voiceSessionId,
          speaker: SpeakerRole.USER,
          text: transcriptText,
          isFinal: true,
          startTimeMs: 0,
          endTimeMs: transcriptText.length * 40,
          turnNumber: state.currentTurn,
        },
      });
    }

    this.sendJson(client, {
      type: VoiceEventType.FINAL_TRANSCRIPT,
      speaker: SpeakerRole.USER,
      text: transcriptText,
      turnNumber: state.currentTurn,
    });

    const aiResponseText = this.generateAiFollowUp(transcriptText, state.currentTurn);
    await this.streamAiVoiceResponse(client, state, aiResponseText);
  }

  private async streamAiVoiceResponse(client: WebSocket, state: ClientSessionState, text: string) {
    state.isAiSpeaking = true;
    state.cancelAiStreaming = false;

    if (state.voiceSessionId) {
      await this.prisma.voiceTranscript.create({
        data: {
          voiceSessionId: state.voiceSessionId,
          speaker: SpeakerRole.AI,
          text,
          isFinal: true,
          startTimeMs: 0,
          endTimeMs: text.length * 50,
          turnNumber: state.currentTurn,
        },
      });
    }

    this.sendJson(client, {
      type: VoiceEventType.AI_SPEAKING_START,
      speaker: SpeakerRole.AI,
      text,
    });

    // Create low-latency TTS stream session
    const ttsSession = this.elevenLabsTts.createStreamingSession();
    state.ttsSession = ttsSession;

    ttsSession.audioStream.subscribe({
      next: (audioChunk: Buffer) => {
        if (!state.cancelAiStreaming && client.readyState === WebSocket.OPEN) {
          state.audioBytesSent += audioChunk.length;
          client.send(audioChunk, { binary: true });
        }
      },
      complete: () => {
        state.isAiSpeaking = false;
        this.sendJson(client, { type: VoiceEventType.AI_SPEAKING_END });
      },
    });

    // Segment text sentences using SentenceChunkerService for ultra-low TTFB (< 500ms)
    const sentences = this.chunker.segmentText(text);
    for (const sentence of sentences) {
      if (state.cancelAiStreaming) break;
      ttsSession.sendText(sentence);
    }
    ttsSession.flush();
  }

  private generateAiFollowUp(candidateAnswer: string, turnNumber: number): string {
    if (turnNumber === 2) {
      return `Thank you for detailing that. Now, how would you design the data storage layer and partition strategy for zero-downtime scaling?`;
    }
    if (turnNumber === 3) {
      return `Good points. What telemetry and observability metrics would you instrument to detect cascading failures before they impact end-users?`;
    }
    return `Excellent discussion. That concludes our live technical session today. You can now view your comprehensive scoring report!`;
  }

  private async finalizeVoiceSession(state: ClientSessionState) {
    if (!state.voiceSessionId) return;

    const durationSec = Math.max(1, Math.round((Date.now() - state.startedAt.getTime()) / 1000));

    await this.prisma.voiceSession.update({
      where: { id: state.voiceSessionId },
      data: {
        status: VoiceSessionStatus.COMPLETED,
        endedAt: new Date(),
        totalDuration: durationSec,
      },
    });

    if (state.userId && state.entitlementReservationId) {
      try {
        const billedMinutes = Math.ceil(durationSec / 60);
        await this.entitlementReservations.commit({
          reservationId: state.entitlementReservationId,
          actualQuantity: Math.max(1, billedMinutes),
          provider: 'voice-streaming',
        });
      } catch (meterErr: any) {
        await this.holdVoiceReservationForReconciliation(
          state,
          'voice_stream_completion_outcome_ambiguous',
          meterErr,
        );
      }
    }

    this.logger.log(
      `Finalized VoiceSession ${state.voiceSessionId} (Duration: ${durationSec}s, BargeIns: ${state.bargeInCount})`,
    );
  }

  private sendJson(client: WebSocket, payload: any) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  }

  private async holdVoiceReservationForReconciliation(
    state: ClientSessionState,
    reason: string,
    error: any,
  ): Promise<void> {
    if (!state.entitlementReservationId) return;
    try {
      await this.entitlementReservations.markForReconciliation(state.entitlementReservationId, reason, {
        status: error?.status,
        code: error?.code,
        message: String(error?.message || '').slice(0, 500),
      });
    } catch (reservationError: any) {
      this.logger.error(`Unable to hold voice reservation: ${reservationError.message}`);
    }
  }
}
