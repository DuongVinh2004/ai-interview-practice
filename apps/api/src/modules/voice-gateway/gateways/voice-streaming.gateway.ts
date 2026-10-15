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
import { VoiceEventType, VoiceSessionStatus, SpeakerRole } from '@ai-interview/contracts';
import { Subscription } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { InterviewService } from '../../interview/interview.service';
import { RedisService } from '../../platform/redis/redis.service';
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
  voiceTicketInterviewId?: string;
  entitlementReservationId?: string;
  isAiSpeaking: boolean;
  aiSpeakingStartedAt?: number;
  aiPlaybackEndsAt?: number;
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
  connecting?: boolean;
  processingAnswer?: boolean;
  finalized?: boolean;
  lastSpokenTurn?: number;
  syncTimer?: ReturnType<typeof setTimeout>;
  language?: string;
  closed?: boolean;
  recordingId?: string;
  recordingText?: string;
  recordingInterim?: string;
  recordingStopping?: boolean;
  audioFrameSecond?: number;
  audioFrameCount?: number;
  speechGeneration?: number;
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
  private readonly VOICE_TICKET_TTL_SECONDS = 60;

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
    @Optional() private readonly redisService?: RedisService,
    @Optional()
    @Inject(forwardRef(() => InterviewService))
    private readonly interviewService?: InterviewService,
  ) {}

  private isProduction(): boolean {
    return (
      this.configService.get<string>('nodeEnv') === 'production' ||
      this.configService.get<string>('app.nodeEnv') === 'production' ||
      process.env.NODE_ENV === 'production'
    );
  }

  private async hasActiveVoiceConsent(userId: string, interviewId: string): Promise<boolean> {
    const consentStore = (this.prisma as any).voiceConsentRecord;
    if (!consentStore?.findUnique) {
      if (this.isProduction()) {
        this.logger.error('Voice consent store is unavailable; rejecting voice ticket.');
        return false;
      }
      // Local gateway tests may omit the optional consent delegate. Real
      // deployments always provide Prisma's voiceConsentRecord delegate.
      return true;
    }

    try {
      const consent = await consentStore.findUnique({
        where: { userId_interviewId: { userId, interviewId } },
        select: { revokedAt: true },
      });
      return Boolean(consent && !consent.revokedAt);
    } catch (err: any) {
      this.logger.warn(`Voice consent verification failed: ${err.message}`);
      return false;
    }
  }

  private async isVoiceTicketSessionRevoked(payload: any): Promise<boolean> {
    if (typeof payload.tokenVersion !== 'number') return false;

    const userStore = (this.prisma as any).user;
    if (!userStore?.findUnique) return this.isProduction();

    try {
      const user = await userStore.findUnique({
        where: { id: payload.sub },
        select: { tokenVersion: true, status: true },
      });
      return !user || user.status === 'LOCKED' || user.tokenVersion !== payload.tokenVersion;
    } catch (err: any) {
      this.logger.warn(`Voice ticket session verification failed: ${err.message}`);
      return true;
    }
  }

  private async claimVoiceTicketJti(jti: string, expiresAt?: number): Promise<boolean> {
    const now = Date.now();
    const ttlSeconds = Math.max(
      1,
      Math.min(
        this.VOICE_TICKET_TTL_SECONDS,
        typeof expiresAt === 'number'
          ? Math.ceil(Math.max(1, expiresAt * 1000 - now) / 1000)
          : this.VOICE_TICKET_TTL_SECONDS,
      ),
    );
    const redisKey = `voice_ticket:${jti}`;
    const client = this.redisService?.getClient?.();

    if (client && client.status === 'ready') {
      try {
        // SET NX is atomic across every API replica sharing this Redis.
        const result = await client.set(redisKey, 'claimed', 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      } catch (err: any) {
        this.logger.warn(`Redis voice ticket claim failed: ${err.message}`);
        if (this.isProduction()) return false;
      }
    } else if (this.isProduction()) {
      this.logger.error('Redis is unavailable; rejecting voice ticket claim.');
      return false;
    }

    for (const [knownJti, expiry] of this.usedTicketJtis) {
      if (expiry <= now) this.usedTicketJtis.delete(knownJti);
    }
    if (this.usedTicketJtis.has(jti)) return false;
    this.usedTicketJtis.set(jti, now + ttlSeconds * 1000);
    return true;
  }

  private async validateVoiceTicket(
    ticket: string,
    interviewId?: string,
  ): Promise<{ sub: string; role: string; jti: string; interviewId: string } | null> {
    try {
      const secret =
        this.configService.get<string>('jwt.accessSecret') ||
        this.configService.get<string>('JWT_ACCESS_SECRET') ||
        'dev-access-secret-min-32-chars-ok';
      const payload = this.jwtService.verify<any>(ticket, { secret });
      if (
        payload.tokenType !== 'VOICE_TICKET' ||
        typeof payload.sub !== 'string' ||
        typeof payload.jti !== 'string' ||
        typeof payload.interviewId !== 'string'
      ) {
        return null;
      }
      if (interviewId && payload.interviewId !== interviewId) return null;
      if (!(await this.hasActiveVoiceConsent(payload.sub, payload.interviewId))) return null;
      if (await this.isVoiceTicketSessionRevoked(payload)) return null;
      if (!(await this.claimVoiceTicketJti(payload.jti, payload.exp))) {
        this.logger.warn(`Rejected replayed voice ticket ${payload.jti}`);
        return null;
      }
      return {
        sub: payload.sub,
        role: payload.role || 'CANDIDATE',
        jti: payload.jti,
        interviewId: payload.interviewId,
      };
    } catch (err: any) {
      this.logger.warn(`Voice ticket verification error: ${err.message}`);
      return null;
    }
  }

  handleConnection(client: WebSocket, req?: any) {
    this.logger.log('Client connected to Voice Gateway WebSocket.');

    const state: ClientSessionState = {
      ws: client,
      userId: undefined,
      authenticatedUser: null,
      voiceTicketJti: undefined,
      voiceTicketInterviewId: undefined,
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
    };
    this.activeClients.set(client, state);

    // Asynchronously verify JWT or Ticket without delaying the message listener attachment
    const handshakePromise = (async () => {
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
          const ticketAuth = await this.validateVoiceTicket(ticket);
          if (ticketAuth) {
            state.authenticatedUser = ticketAuth;
            state.userId = ticketAuth.sub;
            state.voiceTicketJti = ticketAuth.jti;
            state.voiceTicketInterviewId = ticketAuth.interviewId;
            this.enforceSingleActiveConnection(state.userId, client);
          }
        } else if (token) {
          state.authenticatedUser = await this.authService.validateAccessToken(token);
          state.userId = state.authenticatedUser?.sub;
          if (state.userId) {
            this.enforceSingleActiveConnection(state.userId, client);
          }
        }
      } catch (err: any) {
        this.logger.warn(`WebSocket handshake authentication rejected: ${err.message}`);
      }
    })();

    client.on('message', async (data: any, isBinary: boolean) => {
      await handshakePromise;
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
        void this.handleDisconnect(ws);
      }
    }
  }

  async handleDisconnect(client: WebSocket) {
    this.logger.log('Client disconnected from Voice Gateway.');
    const state = this.activeClients.get(client);
    if (state) {
      state.closed = true;
      if (state.syncTimer) clearTimeout(state.syncTimer);
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
      case 'voice:recording-start':
        await this.startRecording(client, state, payload);
        break;
      case 'voice:recording-stop':
        await this.stopRecording(client, state, payload);
        break;
      case 'voice:replay': {
        if (!state.voiceSessionId || state.recordingId || state.isAiSpeaking) break;
        const interview = await this.prisma.interviewSession.findUnique({
          where: { id: state.interviewId },
          include: { turns: { include: { question: true, answer: true } } },
        });
        const turn = interview?.turns.find(t => t.id === payload.turnId);
        if (
          interview?.state === 'ACTIVE' &&
          turn?.question &&
          !turn.answer &&
          turn.turnNumber === interview.currentTurn
        )
          await this.streamAiVoiceResponse(client, state, turn.question.content);
        break;
      }
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
        this.sendJson(client, { type: VoiceEventType.DISCONNECT });
        await this.handleDisconnect(client);
        client.close(1000, 'Voice session ended');
        break;

      case 'ping':
        this.sendJson(client, {
          type: VoiceEventType.CONNECTION_QUALITY,
          clientTimestamp: payload.clientTimestamp,
        });
        break;

      default:
        this.logger.warn(`Unknown voice event type: ${payload.type}`);
    }
  }

  private async handleConnectVoice(client: WebSocket, state: ClientSessionState, payload: any) {
    if (state.connecting || state.voiceSessionId || state.finalized) return;
    state.connecting = true;
    state.interviewId = payload.interviewId;

    if (state.voiceTicketInterviewId && state.voiceTicketInterviewId !== state.interviewId) {
      this.sendJson(client, {
        type: VoiceEventType.ERROR,
        message: 'Voice ticket is not valid for this interview session.',
      });
      client.close(1008, 'Forbidden');
      return;
    }

    if (!state.userId) {
      if (payload.ticket) {
        const ticketAuth = await this.validateVoiceTicket(payload.ticket, payload.interviewId);
        if (ticketAuth) {
          state.authenticatedUser = ticketAuth;
          state.userId = ticketAuth.sub;
          state.voiceTicketJti = ticketAuth.jti;
          state.voiceTicketInterviewId = ticketAuth.interviewId;
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

    // Consent can be revoked after the handshake but before CONNECT. Re-check
    // the durable authority at the point where the stream is actually opened.
    const connectedUserId = state.userId;
    const connectedInterviewId = state.interviewId;
    if (
      state.voiceTicketJti &&
      (!connectedUserId ||
        !connectedInterviewId ||
        !(await this.hasActiveVoiceConsent(connectedUserId, connectedInterviewId)))
    ) {
      this.sendJson(client, {
        type: VoiceEventType.ERROR,
        message: 'Voice consent has been revoked. Acquire a new ticket after consenting again.',
      });
      client.close(1008, 'Voice Ticket Revoked');
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

    if (['COMPLETED', 'CANCELLED', 'FAILED'].includes(interview.state)) {
      this.sendJson(client, {
        type: VoiceEventType.ERROR,
        message: 'Interview is no longer active.',
      });
      client.close(1008, 'Interview ended');
      return;
    }
    state.currentTurn = interview.currentTurn || 1;
    state.language = interview.language || 'vi';
    if (state.closed || client.readyState !== WebSocket.OPEN) return;

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
    if (state.closed || client.readyState !== WebSocket.OPEN) {
      await this.finalizeVoiceSession(state);
      return;
    }

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
          message:
            'Voice quota is unavailable or exhausted. Please use a new ticket after resolving billing.',
        });
        client.close(1008, 'Quota Exceeded');
        return;
      }
    }

    if (state.closed || client.readyState !== WebSocket.OPEN) {
      await this.finalizeVoiceSession(state);
      return;
    }
    this.sendJson(client, {
      type: VoiceEventType.CONNECTED,
      sessionId: voiceSession.id,
      codec: 'pcm16',
      sampleRate: 24000,
    });

    // Initial question from authoritative turn
    const activeTurn = interview.turns.find(t => t.turnNumber === state.currentTurn);
    if (
      activeTurn?.question?.content &&
      !activeTurn.answer &&
      (!interview.state || interview.state === 'ACTIVE')
    ) {
      state.lastSpokenTurn = state.currentTurn;
      await this.streamAiVoiceResponse(client, state, activeTurn.question.content);
    }
    this.scheduleSessionSync(client, state);
  }

  private scheduleSessionSync(client: WebSocket, state: ClientSessionState) {
    if (state.closed || state.finalized || client.readyState !== WebSocket.OPEN) return;
    state.syncTimer = setTimeout(async () => {
      try {
        if (Date.now() - state.startedAt.getTime() >= 900_000) {
          this.sendJson(client, {
            type: VoiceEventType.FALLBACK_TO_TEXT,
            message: 'Voice duration limit reached.',
          });
          await this.handleDisconnect(client);
          client.close(1000, 'Session Duration Limit');
          return;
        }
        await this.syncInterviewTurn(client, state);
      } catch (err: any) {
        this.logger.warn(`Voice session synchronization failed: ${err.message}`);
      }
      this.scheduleSessionSync(client, state);
    }, 1000);
    state.syncTimer.unref();
  }

  private async syncInterviewTurn(client: WebSocket, state: ClientSessionState) {
    if (state.finalized || state.processingAnswer) return;
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: state.interviewId },
      include: { turns: { include: { question: true, answer: true } } },
    });
    if (!interview || state.finalized || client.readyState !== WebSocket.OPEN) return;
    if (['COMPLETED', 'CANCELLED', 'FAILED'].includes(interview.state)) {
      this.sendJson(client, { type: VoiceEventType.DISCONNECT, state: interview.state });
      await this.handleDisconnect(client);
      client.close(1000, 'Interview ended');
      return;
    }
    const turn = interview.turns.find(t => t.turnNumber === interview.currentTurn);
    if (
      interview.state === 'ACTIVE' &&
      turn?.question &&
      !turn.answer &&
      state.lastSpokenTurn !== turn.turnNumber
    ) {
      state.currentTurn = turn.turnNumber;
      state.lastSpokenTurn = turn.turnNumber;
      await this.streamAiVoiceResponse(client, state, turn.question.content);
    }
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
    if (currentSec !== state.audioFrameSecond) {
      state.audioFrameSecond = currentSec;
      state.audioFrameCount = 1;
    } else {
      state.audioFrameCount = (state.audioFrameCount ?? 0) + 1;
      if (state.audioFrameCount > 100) {
        return; // Drop flood frames
      }
    }

    const MAX_AUDIO_FRAME_BYTES = 64 * 1024;
    if (pcmBuffer.length > MAX_AUDIO_FRAME_BYTES || pcmBuffer.length % 2 !== 0) {
      this.sendJson(client, {
        type: VoiceEventType.ERROR,
        message: 'Invalid PCM16 audio frame (64 KB maximum, whole samples required).',
      });
      return;
    }

    if (!state.recordingId || state.recordingStopping) return;
    state.audioBytesReceived += pcmBuffer.length;
    // STT consumes frames immediately; do not retain raw microphone audio.

    // Relay audio chunk to live STT engine
    if (state.sttSession) {
      state.sttSession.sendAudioChunk(pcmBuffer);
    }
  }

  private triggerBargeIn(client: WebSocket, state: ClientSessionState) {
    if (!state.isAiSpeaking && (state.aiPlaybackEndsAt ?? 0) <= Date.now()) return;
    state.bargeInCount += 1;
    state.cancelAiStreaming = true;
    state.speechGeneration = (state.speechGeneration ?? 0) + 1;
    state.isAiSpeaking = false;
    state.aiPlaybackEndsAt = undefined;

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
    if (!transcriptText.trim() || !state.recordingId || state.closed) return;
    state.recordingText = [state.recordingText, transcriptText.trim()].filter(Boolean).join(' ');
    state.recordingInterim = '';
    this.sendJson(client, {
      type: 'voice:recording-draft',
      recordingId: state.recordingId,
      text: state.recordingText,
    });
  }

  private async startRecording(client: WebSocket, state: ClientSessionState, payload: any) {
    if (!state.userId || !state.voiceSessionId || state.recordingId || state.closed) return;
    if (typeof payload.recordingId !== 'string' || payload.recordingId.length > 100) return;
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: state.interviewId },
      include: { turns: { include: { question: true, answer: true } } },
    });
    const turn = interview?.turns.find(t => t.id === payload.turnId);
    if (state.closed || state.recordingId) return;
    if (
      interview?.state !== 'ACTIVE' ||
      !turn?.question ||
      turn.answer ||
      turn.turnNumber !== interview.currentTurn
    ) {
      this.sendJson(client, {
        type: 'voice:recording-error',
        recordingId: payload.recordingId,
        message: 'Câu hỏi đã thay đổi. Vui lòng kiểm tra lại.',
      });
      return;
    }
    this.triggerBargeIn(client, state);
    state.recordingId = payload.recordingId;
    state.recordingText = '';
    state.recordingInterim = '';
    state.recordingStopping = false;
    try {
      const stream = this.deepgramStt.createSttStream(16000, state.language || 'vi');
      state.sttSession = stream;
      const id = state.recordingId;
      state.sttSubscription = stream.events.subscribe({
        next: event => {
          if (state.recordingId !== id || state.closed) return;
          if (event.isFinal) void this.handleCandidateFinalTranscript(client, state, event.text);
          else {
            state.recordingInterim = event.text;
            this.sendJson(client, {
              type: 'voice:recording-draft',
              recordingId: id,
              text: [state.recordingText, event.text].filter(Boolean).join(' '),
            });
          }
        },
        error: () => {
          if (state.recordingId !== id) return;
          this.sendJson(client, {
            type: 'voice:recording-error',
            recordingId: id,
            text: [state.recordingText, state.recordingInterim].filter(Boolean).join(' '),
            message: 'Nhận diện bị gián đoạn. Hãy kiểm tra bản nháp hoặc nhập chữ.',
          });
          state.recordingId = undefined;
          stream.close();
        },
      });
      this.sendJson(client, { type: 'voice:recording-started', recordingId: id });
    } catch {
      state.recordingId = undefined;
      this.sendJson(client, {
        type: 'voice:recording-error',
        recordingId: payload.recordingId,
        message: 'Không thể bật nhận diện. Bạn vẫn có thể nhập chữ.',
      });
    }
  }

  private async stopRecording(client: WebSocket, state: ClientSessionState, payload: any) {
    if (!state.recordingId || state.recordingId !== payload.recordingId || state.recordingStopping)
      return;
    state.recordingStopping = true;
    const id = state.recordingId;
    let message: string | undefined;
    try {
      if (state.sttSession?.finish) await state.sttSession.finish();
      else state.sttSession?.close();
    } catch {
      message = 'Chưa xác nhận được toàn bộ nhận diện. Hãy kiểm tra phần cuối bản nháp.';
    }
    if (state.recordingId !== id || state.closed) return;
    this.sendJson(client, {
      type: 'voice:recording-stopped',
      recordingId: id,
      text: [state.recordingText, state.recordingInterim].filter(Boolean).join(' '),
      message,
    });
    state.recordingId = undefined;
    state.sttSubscription?.unsubscribe();
    state.sttSession?.close();
    state.sttSession = undefined;
  }

  private async streamAiVoiceResponse(client: WebSocket, state: ClientSessionState, text: string) {
    const generation = (state.speechGeneration = (state.speechGeneration ?? 0) + 1);
    state.isAiSpeaking = true;
    state.aiSpeakingStartedAt = Date.now();
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

    if (
      state.closed ||
      state.finalized ||
      state.cancelAiStreaming ||
      state.speechGeneration !== generation ||
      client.readyState !== WebSocket.OPEN
    )
      return;
    this.sendJson(client, {
      type: VoiceEventType.AI_SPEAKING_START,
      speaker: SpeakerRole.AI,
      text,
    });

    // Close previous TTS session if still running
    if (state.ttsSession) {
      state.ttsSubscription?.unsubscribe();
      try {
        state.ttsSession.close();
      } catch {
        // ignore close error
      }
      state.ttsSession = undefined;
    }

    // Create low-latency TTS stream session
    let ttsSession: TtsStreamSession;
    try {
      ttsSession = this.elevenLabsTts.createStreamingSession(undefined, state.language);
    } catch (error: any) {
      state.isAiSpeaking = false;
      this.logger.warn(`Voice playback initialization failed: ${error.message}`);
      this.sendJson(client, {
        type: 'voice:playback-error',
        message: 'Không thể phát câu hỏi. Bạn vẫn có thể nhập hoặc ghi âm câu trả lời.',
      });
      return;
    }
    state.ttsSession = ttsSession;

    state.ttsSubscription?.unsubscribe();
    state.ttsSubscription = ttsSession.audioStream.subscribe({
      next: (audioChunk: Buffer) => {
        if (
          state.ttsSession === ttsSession &&
          !state.cancelAiStreaming &&
          client.readyState === WebSocket.OPEN
        ) {
          state.audioBytesSent += audioChunk.length;
          this.sendJson(client, { type: 'voice:audio-format', codec: ttsSession.codec || 'pcm16' });
          state.aiPlaybackEndsAt =
            Math.max(Date.now(), state.aiPlaybackEndsAt ?? 0) +
            (ttsSession.codec === 'mp3' ? (text.length / 15) * 1000 : audioChunk.length / 48);
          client.send(audioChunk, { binary: true });
        }
      },
      complete: () => {
        if (state.ttsSession !== ttsSession) return;
        state.isAiSpeaking = false;
        this.sendJson(client, { type: VoiceEventType.AI_SPEAKING_END });
      },
      error: (err: Error) => {
        if (state.ttsSession !== ttsSession) return;
        state.isAiSpeaking = false;
        this.logger.warn(`Voice playback failed: ${err.message}`);
        this.sendJson(client, {
          type: 'voice:playback-error',
          message:
            'Không thể phát câu hỏi. Vui lòng đọc câu hỏi và nhập câu trả lời, hoặc thử kết nối lại.',
        });
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

  private async finalizeVoiceSession(state: ClientSessionState) {
    if (!state.voiceSessionId || state.finalized) return;
    state.finalized = true;
    if (state.syncTimer) clearTimeout(state.syncTimer);

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
      await this.entitlementReservations.markForReconciliation(
        state.entitlementReservationId,
        reason,
        {
          status: error?.status,
          code: error?.code,
          message: String(error?.message || '').slice(0, 500),
        },
      );
    } catch (reservationError: any) {
      this.logger.error(`Unable to hold voice reservation: ${reservationError.message}`);
    }
  }
}
