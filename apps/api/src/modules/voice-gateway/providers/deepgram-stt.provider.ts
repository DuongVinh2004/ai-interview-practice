import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeepgramClient } from '@deepgram/sdk';
import { Subject } from 'rxjs';
import { TranscriptEvent, SttStreamSession } from '../interfaces/voice-provider.interface';
import { SpeakerRole } from '@ai-interview/contracts';

@Injectable()
export class DeepgramSttProvider {
  private readonly logger = new Logger(DeepgramSttProvider.name);
  private readonly apiKey: string;
  private isConfigured: boolean;
  private readonly deepgram: any;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('voice.deepgramApiKey') ||
      process.env.DEEPGRAM_API_KEY ||
      '';
    this.isConfigured = Boolean(this.apiKey && !this.apiKey.includes('mock') && this.apiKey.length > 5);

    if (this.isConfigured) {
      try {
        this.deepgram = new DeepgramClient({ apiKey: this.apiKey });
        this.logger.log('Deepgram STT SDK client initialized successfully.');
      } catch (err: any) {
        this.logger.warn(`Failed to initialize Deepgram SDK, falling back to mock: ${err.message}`);
        this.isConfigured = false;
      }
    } else {
      this.logger.log('Deepgram API Key not set. Using Mock STT Stream Provider.');
    }
  }

  createSttStream(sampleRate = 16000, language = 'en-US'): SttStreamSession {
    const events = new Subject<TranscriptEvent>();

    if (this.isConfigured && this.deepgram?.listen?.live) {
      try {
        const liveConnection = this.deepgram.listen.live({
          model: 'nova-2',
          language,
          smart_format: true,
          encoding: 'linear16',
          sample_rate: sampleRate,
          interim_results: true,
          endpointing: 300,
          vad_events: true,
        });

        liveConnection.on('Results', (data: any) => {
          const transcript = data.channel?.alternatives?.[0]?.transcript;
          if (!transcript || transcript.trim() === '') return;

          const isFinal = Boolean(data.is_final || data.speech_final);
          events.next({
            text: transcript.trim(),
            isFinal,
            confidence: data.channel.alternatives[0].confidence,
            speaker: SpeakerRole.USER,
          });
        });

        liveConnection.on('error', (err: any) => {
          this.logger.error(`Deepgram Live Stream error: ${err.message}`);
        });

        return {
          sendAudioChunk: (pcmChunk: Buffer) => {
            if (typeof liveConnection.getReadyState === 'function' && liveConnection.getReadyState() === 1) {
              liveConnection.send(pcmChunk);
            }
          },
          events,
          close: () => {
            try {
              if (typeof liveConnection.finish === 'function') {
                liveConnection.finish();
              }
            } catch {
              // ignore
            }
          },
        };
      } catch (err: any) {
        this.logger.error(`Error opening Deepgram connection: ${err.message}`);
      }
    }

    // Mock STT Stream Fallback
    let accumulatedBytes = 0;
    let turnCount = 0;

    return {
      sendAudioChunk: (pcmChunk: Buffer) => {
        accumulatedBytes += pcmChunk.length;

        // Emit interim transcript after every ~16KB (0.5s audio)
        if (accumulatedBytes > 16000 && accumulatedBytes % 16000 < pcmChunk.length) {
          events.next({
            text: 'I would structure the microservices...',
            isFinal: false,
            confidence: 0.88,
            speaker: SpeakerRole.USER,
          });
        }
      },
      events,
      close: () => {
        turnCount++;
        const finalAnswers = [
          'For high concurrency, we should decouple ingestion with Kafka message queues and write-through Redis cache.',
          'To ensure zero downtime, we implement rolling deployments with health checks and database read replicas.',
          'We monitor p99 latency with OpenTelemetry metrics and circuit breakers to prevent cascading downstream failures.',
        ];
        const selectedText = finalAnswers[(turnCount - 1) % finalAnswers.length];

        events.next({
          text: selectedText,
          isFinal: true,
          confidence: 0.96,
          speaker: SpeakerRole.USER,
        });
        events.complete();
      },
    };
  }
}
