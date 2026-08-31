import { ConflictException, Injectable, Logger, HttpStatus, Optional } from '@nestjs/common';
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
import {
  EntitlementMetric,
  EntitlementReservationService,
} from '../billing/entitlement-reservation.service';
import { BillingMetric } from '@ai-interview/contracts';
import {
  BudgetReservation,
  DistributedBudgetService,
} from '../platform/budget/distributed-budget.service';

@Injectable()
export class AudioOrchestratorService {
  private readonly logger = new Logger(AudioOrchestratorService.name);
  private readonly providersMap = new Map<string, AudioProviderInterface>();
  private readonly circuitBreaker: CircuitBreaker;
  private readonly dailyBudgetUsd: number;
  private readonly maxProviderCallCostUsd: number;
  private currentDailyCostUsd = 0;
  private lastBudgetResetDay = new Date().getUTCDate();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly openAiAudioProvider: OpenAiAudioProvider,
    private readonly mockAudioProvider: MockAudioProvider,
    private readonly entitlementReservations: EntitlementReservationService,
    @Optional() private readonly distributedBudget?: DistributedBudgetService,
  ) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      windowMs: 60_000,
      resetTimeoutMs: 30_000,
    });

    this.providersMap.set('openai', this.openAiAudioProvider);
    this.providersMap.set('mock', this.mockAudioProvider);

    this.dailyBudgetUsd = this.configService.get<number>('ai.dailyBudgetUsd', 50.0);
    this.maxProviderCallCostUsd = this.configService.get<number>('ai.maxProviderCallCostUsd', 2.0);
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
    idempotencyKey?: string,
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
    const cleanIdempotencyKey = this.requireIdempotencyKey(idempotencyKey);
    const estimatedMinutes = this.estimateTranscriptionMinutes(audioBuffer, mimeType);
    let lastError: any = null;
    const startTime = Date.now();

    for (const providerName of priorityChain) {
      const provider = this.providersMap.get(providerName);
      if (!provider) continue;

      if (!this.circuitBreaker.canExecute(providerName, 'audio-transcribe')) {
        this.logger.warn(
          `Circuit breaker OPEN for [${providerName}:audio-transcribe]. Cascading...`,
        );
        continue;
      }

      let reservation: any;
      let budgetReservation: BudgetReservation | undefined;
      let providerDispatchStarted = false;
      try {
        if (providerName !== 'mock') {
          const budget = await this.reserveDistributedBudget('audio-transcribe', providerName);
          if (budget === null) {
            this.logger.warn(
              `Skipping paid audio provider [${providerName}] due to global budget cap.`,
            );
            continue;
          }
          budgetReservation = budget;
          reservation = await this.entitlementReservations.reserve({
            userId,
            metric: EntitlementMetric.AUDIO_MINUTES,
            quantity: estimatedMinutes,
            idempotencyKey: cleanIdempotencyKey,
            operationType: 'audio.transcribe',
            operationId: sessionId || this.audioFingerprint(audioBuffer, filename),
          });
          this.requireFreshReservation(reservation);
          await this.entitlementReservations.markProviderDispatchStarted(
            reservation.id,
            providerName,
          );
          providerDispatchStarted = true;
        }
        const result = await this.circuitBreaker.execute(
          providerName,
          'audio-transcribe',
          async () => {
            return await provider.transcribe(audioBuffer, mimeType, filename, language);
          },
        );

        if (budgetReservation) {
          await this.distributedBudget!.settle(budgetReservation, result.costEstimate || 0);
          budgetReservation = undefined;
        }
        if (result.costEstimate) {
          this.checkDailyBudget(result.costEstimate);
        }

        if (reservation) {
          await this.entitlementReservations.commit({
            reservationId: reservation.id,
            actualQuantity: this.durationToMinutes(result.durationSeconds, estimatedMinutes),
            provider: result.provider,
            billingMetric: BillingMetric.AUDIO_MINUTE,
          });
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
        if (budgetReservation && this.distributedBudget && !providerDispatchStarted) {
          await this.distributedBudget.release(budgetReservation);
        }
        if (reservation) {
          await this.resolvePaidProviderFailure(reservation.id, error);
        }
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
    idempotencyKey?: string,
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
    const cleanIdempotencyKey = this.requireIdempotencyKey(idempotencyKey);
    const estimatedMinutes = this.estimateSynthesisMinutes(text, speed);
    let lastError: any = null;
    const startTime = Date.now();

    for (const providerName of priorityChain) {
      const provider = this.providersMap.get(providerName);
      if (!provider) continue;

      if (!this.circuitBreaker.canExecute(providerName, 'audio-synthesize')) {
        this.logger.warn(
          `Circuit breaker OPEN for [${providerName}:audio-synthesize]. Cascading...`,
        );
        continue;
      }

      let reservation: any;
      let budgetReservation: BudgetReservation | undefined;
      let providerDispatchStarted = false;
      try {
        if (providerName !== 'mock') {
          const budget = await this.reserveDistributedBudget('audio-synthesize', providerName);
          if (budget === null) {
            this.logger.warn(
              `Skipping paid audio provider [${providerName}] due to global budget cap.`,
            );
            continue;
          }
          budgetReservation = budget;
          reservation = await this.entitlementReservations.reserve({
            userId,
            metric: EntitlementMetric.AUDIO_MINUTES,
            quantity: estimatedMinutes,
            idempotencyKey: cleanIdempotencyKey,
            operationType: 'audio.synthesize',
            operationId: sessionId || this.textFingerprint(text, voice, speed),
          });
          this.requireFreshReservation(reservation);
          await this.entitlementReservations.markProviderDispatchStarted(
            reservation.id,
            providerName,
          );
          providerDispatchStarted = true;
        }
        const result = await this.circuitBreaker.execute(
          providerName,
          'audio-synthesize',
          async () => {
            return await provider.synthesize(text, voice, speed);
          },
        );

        if (budgetReservation) {
          await this.distributedBudget!.settle(budgetReservation, result.costEstimate || 0);
          budgetReservation = undefined;
        }
        if (result.costEstimate) {
          this.checkDailyBudget(result.costEstimate);
        }

        if (reservation) {
          await this.entitlementReservations.commit({
            reservationId: reservation.id,
            actualQuantity: this.durationToMinutes(result.durationSeconds, estimatedMinutes),
            provider: result.provider,
            billingMetric: BillingMetric.AUDIO_MINUTE,
          });
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
        if (budgetReservation && this.distributedBudget && !providerDispatchStarted) {
          await this.distributedBudget.release(budgetReservation);
        }
        if (reservation) {
          await this.resolvePaidProviderFailure(reservation.id, error);
        }
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

  private async reserveDistributedBudget(
    operation: string,
    providerName: string,
  ): Promise<BudgetReservation | undefined | null> {
    if (!this.distributedBudget) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Distributed AI budget enforcement is unavailable');
      }
      return this.checkDailyBudget(0) ? undefined : null;
    }

    try {
      return await this.distributedBudget.reserve(
        'ai-provider-global',
        this.dailyBudgetUsd,
        this.maxProviderCallCostUsd,
      );
    } catch (error: any) {
      this.logger.error(
        `Global AI budget reservation failed for [${providerName}:${operation}]: ${error.message}`,
      );
      if (process.env.NODE_ENV === 'production') throw error;
      return this.checkDailyBudget(0) ? undefined : null;
    }
  }

  private requireIdempotencyKey(idempotencyKey?: string): string {
    const cleanKey = idempotencyKey?.trim();
    if (!cleanKey || cleanKey.length > 255) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Idempotency-Key header is required for audio operations.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return cleanKey;
  }

  private requireFreshReservation(reservation: any): void {
    if (reservation?.state === 'RESERVED' && reservation?.isNewReservation === true) return;
    if (reservation?.state === 'RECONCILIATION_REQUIRED') {
      throw new ConflictException('The earlier paid audio operation is awaiting reconciliation.');
    }
    throw new ConflictException(
      'This audio operation has already been processed; use a new idempotency key.',
    );
  }

  private async resolvePaidProviderFailure(reservationId: string, error: any): Promise<void> {
    try {
      // Input validation happens before an upstream operation. Every other error
      // is treated as ambiguous and held so a retry cannot duplicate a paid call.
      if (error?.status === HttpStatus.BAD_REQUEST) {
        await this.entitlementReservations.release(
          reservationId,
          'provider_rejected_preflight_input',
        );
        return;
      }
      await this.entitlementReservations.markForReconciliation(
        reservationId,
        'paid_audio_provider_outcome_ambiguous',
        {
          status: error?.status,
          code: error?.code,
          message: String(error?.message || '').slice(0, 500),
        },
      );
    } catch (resolutionError: any) {
      this.logger.error(
        `Unable to resolve entitlement reservation ${reservationId}: ${resolutionError.message}`,
      );
    }
  }

  private durationToMinutes(durationSeconds: number | undefined, estimate: number): number {
    if (!durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0)
      return estimate;
    return Math.max(1, Math.ceil(durationSeconds / 60));
  }

  private estimateTranscriptionMinutes(audioBuffer: Buffer, mimeType: string): number {
    const wavSeconds = this.readWavDurationSeconds(audioBuffer, mimeType);
    if (wavSeconds !== undefined) return Math.max(1, Math.ceil(wavSeconds / 60));

    // For containers without a trustworthy duration header, reserve the maximum
    // accepted request duration. A later provider-reported duration is committed
    // exactly; a larger actual value stays fail-closed for reconciliation.
    return 15;
  }

  private estimateSynthesisMinutes(text: string, speed: number): number {
    const normalizedSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
    return Math.max(1, Math.ceil(text.trim().length / (900 * normalizedSpeed)));
  }

  private readWavDurationSeconds(audioBuffer: Buffer, mimeType: string): number | undefined {
    if (!mimeType.toLowerCase().includes('wav') || audioBuffer.length < 44) return undefined;
    if (
      audioBuffer.toString('ascii', 0, 4) !== 'RIFF' ||
      audioBuffer.toString('ascii', 8, 12) !== 'WAVE'
    ) {
      return undefined;
    }
    const byteRate = audioBuffer.readUInt32LE(28);
    const dataLength = audioBuffer.readUInt32LE(40);
    if (!byteRate || !dataLength) return undefined;
    return dataLength / byteRate;
  }

  private audioFingerprint(audioBuffer: Buffer, filename: string): string {
    return `${filename}:${audioBuffer.length}:${audioBuffer.subarray(0, 32).toString('base64')}`;
  }

  private textFingerprint(text: string, voice: AudioVoice, speed: number): string {
    return `${voice}:${speed}:${text.trim()}`;
  }
}
