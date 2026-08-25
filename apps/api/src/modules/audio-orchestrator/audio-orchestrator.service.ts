import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../platform/prisma/prisma.service';
import {
  AudioProviderInterface,
  AudioSttResult,
  AudioTtsResult,
} from './interfaces/audio-provider.interface';
import { OpenAiAudioProvider } from './providers/openai-audio.provider';
import { MockAudioProvider } from './providers/mock-audio.provider';
import { CircuitBreaker } from '../ai-orchestrator/resilience/circuit-breaker';
import { AudioVoice, AiRunStatus, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../platform/filters/all-exceptions.filter';

@Injectable()
export class AudioOrchestratorService {
  private readonly logger = new Logger(AudioOrchestratorService.name);
  private readonly providersMap = new Map<string, AudioProviderInterface>();
  private readonly circuitBreaker: CircuitBreaker;
  private readonly dailyBudgetUsd: number;
  private currentDailyCostUsd = 0;
  private lastBudgetResetDay = new Date().getUTCDate();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly openAiAudioProvider: OpenAiAudioProvider,
    private readonly mockAudioProvider: MockAudioProvider,
  ) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      windowMs: 60_000,
      resetTimeoutMs: 30_000,
    });

    this.providersMap.set('openai', this.openAiAudioProvider);
    this.providersMap.set('mock', this.mockAudioProvider);

    this.dailyBudgetUsd = this.configService.get<number>('ai.dailyBudgetUsd', 50.0);
    this.logger.log(
      `Audio Orchestrator initialized (Priority Chain: ${this.getPriorityChain().join(' -> ')})`,
    );
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  /**
   * Resolves provider priority chain for audio operations.
   */
  getPriorityChain(): string[] {
    const configured = this.configService.get<string>('ai.provider', 'mock').toLowerCase();

    if (configured === 'mock') {
      return ['mock'];
    }

    if (configured === 'openai') {
      return ['openai', 'mock'];
    }

    const priority = this.configService.get<string>('ai.providerPriority', 'openai,mock');
    const parsed = priority
      .split(',')
      .map(p => p.trim().toLowerCase())
      .filter(p => this.providersMap.has(p));

    if (!parsed.includes('mock')) {
      parsed.push('mock');
    }

    return parsed.length > 0 ? parsed : ['mock'];
  }

  /**
   * Checks and updates daily cost accumulator.
   */
  private checkDailyBudget(costToAdd: number = 0): boolean {
    const currentDay = new Date().getUTCDate();
    if (currentDay !== this.lastBudgetResetDay) {
      this.currentDailyCostUsd = 0;
      this.lastBudgetResetDay = currentDay;
    }

    this.currentDailyCostUsd += costToAdd;

    if (this.currentDailyCostUsd >= this.dailyBudgetUsd) {
      this.logger.warn(
        `Daily AI budget of $${this.dailyBudgetUsd.toFixed(2)} exceeded for Audio. Switching to zero-cost fallback mode.`,
      );
      return false;
    }

    return true;
  }

  async transcribeAudio(
    userId: string,
    audioBuffer: Buffer,
    mimeType: string = 'audio/webm',
    filename: string = 'audio.webm',
    language?: string,
    sessionId?: string,
  ): Promise<AudioSttResult> {
    // Ownership check: verify session belongs to user (F-008)
    if (sessionId) {
      const session = await this.prisma.interviewSession.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      });
      if (session && session.userId !== userId) {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'Access denied: Session does not belong to user',
          HttpStatus.FORBIDDEN,
        );
      }
    }
    const priorityChain = this.getPriorityChain();
    let lastError: any = null;
    const startTime = Date.now();

    for (const providerName of priorityChain) {
      const provider = this.providersMap.get(providerName);
      if (!provider) continue;

      if (providerName !== 'mock' && !this.checkDailyBudget(0)) {
        this.logger.warn(`Skipping paid audio provider [${providerName}] due to budget cap.`);
        continue;
      }

      if (!this.circuitBreaker.canExecute(providerName, 'audio-transcribe')) {
        this.logger.warn(
          `Circuit breaker OPEN for [${providerName}:audio-transcribe]. Cascading...`,
        );
        continue;
      }

      try {
        const result = await this.circuitBreaker.execute(
          providerName,
          'audio-transcribe',
          async () => {
            return await provider.transcribe(audioBuffer, mimeType, filename, language);
          },
        );

        if (result.costEstimate) {
          this.checkDailyBudget(result.costEstimate);
        }

        await this.auditAudioRun({
          sessionId,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs || Date.now() - startTime,
          costEstimate: result.costEstimate,
          status: AiRunStatus.SUCCESS,
          metadata: {
            operation: 'audio-transcribe',
            durationSeconds: result.durationSeconds,
            detectedLanguage: result.detectedLanguage,
          },
        });

        return result;
      } catch (error: any) {
        lastError = error;
        this.logger.error(
          `Audio provider [${providerName}] transcribe failed: ${error.message}. Cascading to next fallback...`,
        );
      }
    }

    await this.auditAudioRun({
      sessionId,
      provider: 'audio-orchestrator',
      model: 'unknown',
      latencyMs: Date.now() - startTime,
      status: AiRunStatus.FAILED,
      errorCode: lastError?.code || ErrorCode.AUDIO_TRANSCRIPTION_FAILED,
      metadata: { operation: 'audio-transcribe', error: lastError?.message },
    });

    throw (
      lastError ||
      new DomainException(
        ErrorCode.AUDIO_TRANSCRIPTION_FAILED,
        'All audio STT providers in fallback chain failed.',
        500,
      )
    );
  }

  async synthesizeSpeech(
    userId: string,
    text: string,
    voice: AudioVoice = AudioVoice.ALLOY,
    speed: number = 1.0,
    sessionId?: string,
  ): Promise<AudioTtsResult> {
    // Ownership check: verify session belongs to user (F-008)
    if (sessionId) {
      const session = await this.prisma.interviewSession.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      });
      if (session && session.userId !== userId) {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'Access denied: Session does not belong to user',
          HttpStatus.FORBIDDEN,
        );
      }
    }
    const priorityChain = this.getPriorityChain();
    let lastError: any = null;
    const startTime = Date.now();

    for (const providerName of priorityChain) {
      const provider = this.providersMap.get(providerName);
      if (!provider) continue;

      if (providerName !== 'mock' && !this.checkDailyBudget(0)) {
        this.logger.warn(`Skipping paid audio provider [${providerName}] due to budget cap.`);
        continue;
      }

      if (!this.circuitBreaker.canExecute(providerName, 'audio-synthesize')) {
        this.logger.warn(
          `Circuit breaker OPEN for [${providerName}:audio-synthesize]. Cascading...`,
        );
        continue;
      }

      try {
        const result = await this.circuitBreaker.execute(
          providerName,
          'audio-synthesize',
          async () => {
            return await provider.synthesize(text, voice, speed);
          },
        );

        if (result.costEstimate) {
          this.checkDailyBudget(result.costEstimate);
        }

        await this.auditAudioRun({
          sessionId,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs || Date.now() - startTime,
          costEstimate: result.costEstimate,
          status: AiRunStatus.SUCCESS,
          metadata: {
            operation: 'audio-synthesize',
            durationSeconds: result.durationSeconds,
            voice,
            speed,
          },
        });

        return result;
      } catch (error: any) {
        lastError = error;
        this.logger.error(
          `Audio provider [${providerName}] synthesize failed: ${error.message}. Cascading to next fallback...`,
        );
      }
    }

    await this.auditAudioRun({
      sessionId,
      provider: 'audio-orchestrator',
      model: 'unknown',
      latencyMs: Date.now() - startTime,
      status: AiRunStatus.FAILED,
      errorCode: lastError?.code || ErrorCode.AUDIO_SYNTHESIS_FAILED,
      metadata: { operation: 'audio-synthesize', error: lastError?.message },
    });

    throw (
      lastError ||
      new DomainException(
        ErrorCode.AUDIO_SYNTHESIS_FAILED,
        'All audio TTS providers in fallback chain failed.',
        500,
      )
    );
  }

  private async auditAudioRun(data: {
    sessionId?: string;
    provider: string;
    model: string;
    latencyMs: number;
    costEstimate?: number;
    status: AiRunStatus;
    errorCode?: string;
    metadata?: any;
  }) {
    try {
      await this.prisma.aiRun.create({
        data: {
          sessionId: data.sessionId,
          provider: data.provider,
          model: data.model,
          latencyMs: data.latencyMs,
          costEstimate: data.costEstimate,
          status: data.status,
          errorCode: data.errorCode,
          metadata: data.metadata,
        },
      });
    } catch (e: any) {
      this.logger.error('Failed to persist Audio AI audit run', e.message);
    }
  }
}
