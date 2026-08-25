import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
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

interface ClientSessionState {
  ws: WebSocket;
  interviewId?: string;
  voiceSessionId?: string;
  userId?: string;
  authenticatedUser?: any;
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
  ) {}

  handleConnection(client: WebSocket, req?: any) {
    this.logger.log('Client connected to Voice Gateway WebSocket.');

    let authenticatedUser: any = null;
    let userId: string | undefined = undefined;

    // Extract & verify JWT
    try {
      let token: string | undefined;
      if (req?.url) {
        const parsedUrl = new URL(req.url, 'http://localhost');
        token = parsedUrl.searchParams.get('token') || undefined;
      }
      if (!token && req?.headers?.authorization) {
        const authHeader = req.headers.authorization as string;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }
      if (token) {
        const secret =
          this.configService.get<string>('jwt.accessSecret') ||
          this.configService.get<string>('JWT_ACCESS_SECRET');
        authenticatedUser = this.jwtService.verify(token, { secret });
        userId = authenticatedUser?.sub;
        this.logger.log(`Authenticated WebSocket client: ${userId}`);
      }
    } catch (err: any) {
      this.logger.warn(`Handshake JWT verification failed: ${err.message}`);
    }

    this.activeClients.set(client, {
      ws: client,
      userId,
      authenticatedUser,
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

    if (!state.userId && payload.token) {
      try {
        const secret =
          this.configService.get<string>('jwt.accessSecret') ||
          this.configService.get<string>('JWT_ACCESS_SECRET');
        state.authenticatedUser = this.jwtService.verify(payload.token, { secret });
        state.userId = state.authenticatedUser?.sub;
      } catch (err: any) {
        this.logger.warn(`Event JWT verification failed: ${err.message}`);
      }
    }

    if (!state.userId) {
      this.sendJson(client, {
        type: VoiceEventType.ERROR,
        message: 'Authentication required. Missing or invalid JWT token.',
      });
      client.close(1008, 'Unauthorized');
      return;
    }

    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: payload.interviewId },
      include: {
        jobRole: true,
        seniorityLevel: true,
        turns: {
          orderBy: { turnNumber: 'asc' },
          include: { question: true },
        },
      },
    });

    if (!interview) {
      this.sendJson(client, { type: VoiceEventType.ERROR, message: 'Interview session not found' });
      return;
    }

    if (interview.userId !== state.userId && state.authenticatedUser?.role !== 'ADMIN') {
      this.sendJson(client, {
        type: VoiceEventType.ERROR,
        message: 'Forbidden. You are not authorized to access this interview session.',
      });
      client.close(1008, 'Forbidden');
      return;
    }

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

    // Initialize Deepgram STT Stream Session
    const sttStream = this.deepgramStt.createSttStream(24000);
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

    // Initial question
    const firstTurn = interview.turns[0];
    const initialQuestion =
      firstTurn?.question?.content ||
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

    state.currentTurn += 1;
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

    this.logger.log(
      `Finalized VoiceSession ${state.voiceSessionId} (Duration: ${durationSec}s, BargeIns: ${state.bargeInCount})`,
    );
  }

  private sendJson(client: WebSocket, payload: any) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  }
}
