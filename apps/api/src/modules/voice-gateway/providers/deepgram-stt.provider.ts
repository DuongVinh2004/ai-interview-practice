import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { Subject } from 'rxjs';
import { TranscriptEvent, SttStreamSession } from '../interfaces/voice-provider.interface';
import { SpeakerRole, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

@Injectable()
export class DeepgramSttProvider {
  private readonly logger = new Logger(DeepgramSttProvider.name);
  private readonly apiKey: string;
  private isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('voice.deepgramApiKey') || process.env.DEEPGRAM_API_KEY || '';
    this.isConfigured = Boolean(
      this.apiKey && !this.apiKey.includes('mock') && this.apiKey.length > 5,
    );

    if (this.isConfigured) {
      this.logger.log('Deepgram STT API Key configured successfully.');
    } else {
      this.logger.log('Deepgram API Key not set. Using Mock STT Stream Provider.');
    }
  }

  isPaidConfigured(): boolean {
    return this.isConfigured;
  }

  createSttStream(sampleRate = 16000, language = 'vi'): SttStreamSession {
    const events = new Subject<TranscriptEvent>();
    let finalSegments: string[] = [];

    if (this.isConfigured) {
      try {
        const langParam = language === 'en' || language === 'en-US' ? 'en-US' : 'vi';
        const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=${langParam}&smart_format=true&encoding=linear16&sample_rate=${sampleRate}&interim_results=true&endpointing=1200&vad_events=true`;
        const liveWs = new WebSocket(wsUrl, {
          headers: { Authorization: `Token ${this.apiKey}` },
        });
        const pendingAudio: Buffer[] = [];
        let pendingBytes = 0;
        let finishing = false;
        let finishResolve: (() => void) | undefined;
        let finishReject: ((error: Error) => void) | undefined;
        let finishTimer: ReturnType<typeof setTimeout> | undefined;
        let finishPromise: Promise<void> | undefined;
        const keepAlive = setInterval(() => {
          if (liveWs.readyState === WebSocket.OPEN)
            liveWs.send(JSON.stringify({ type: 'KeepAlive' }));
        }, 5000);
        keepAlive.unref();

        liveWs.on('open', () => {
          this.logger.log(`Connected to Deepgram Live STT WebSocket (${langParam})`);
          for (const chunk of pendingAudio) liveWs.send(chunk);
          pendingAudio.length = 0;
          pendingBytes = 0;
          if (finishing) liveWs.send(JSON.stringify({ type: 'CloseStream' }));
        });

        liveWs.on('message', (data: WebSocket.Data) => {
          try {
            const parsed = JSON.parse(data.toString());
            if (parsed.type === 'Metadata' && finishing) {
              if (finalSegments.length)
                events.next({ text: finalSegments.join(' '), isFinal: true });
              finalSegments = [];
              clearTimeout(finishTimer);
              finishResolve?.();
              events.complete();
              return;
            }
            const transcript = parsed.channel?.alternatives?.[0]?.transcript;
            if (parsed.is_final && transcript?.trim()) finalSegments.push(transcript.trim());
            const isFinal = Boolean(parsed.speech_final);
            const text = isFinal
              ? finalSegments.join(' ')
              : [
                  ...finalSegments,
                  ...(!parsed.is_final && transcript?.trim() ? [transcript.trim()] : []),
                ].join(' ');
            if (isFinal) finalSegments = [];
            if (!text) return;
            events.next({
              text,
              isFinal,
              confidence: parsed.channel?.alternatives?.[0]?.confidence || 0.9,
              speaker: SpeakerRole.USER,
            });
          } catch {
            // Ignore non-json frames
          }
        });

        liveWs.on('error', (err: any) => {
          clearInterval(keepAlive);
          this.logger.error(`Deepgram Live Stream error: ${err.message}`);
          events.error(err);
          clearTimeout(finishTimer);
          finishReject?.(err);
        });
        liveWs.on('close', () => {
          clearInterval(keepAlive);
          clearTimeout(finishTimer);
          if (!events.isStopped)
            finishReject?.(new Error('Recognition ended before final confirmation'));
          if (!events.closed && !events.isStopped)
            events.error(new Error('Speech recognition connection closed'));
        });

        return {
          sendAudioChunk: (pcmChunk: Buffer) => {
            if (liveWs.readyState === WebSocket.OPEN) {
              liveWs.send(pcmChunk);
            } else if (
              liveWs.readyState === WebSocket.CONNECTING &&
              pendingBytes + pcmChunk.length <= 64000
            ) {
              pendingAudio.push(pcmChunk);
              pendingBytes += pcmChunk.length;
            }
          },
          events,
          finish: () => {
            if (finishPromise) return finishPromise;
            finishing = true;
            finishPromise = new Promise<void>((resolve, reject) => {
              finishResolve = resolve;
              finishReject = reject;
              finishTimer = setTimeout(
                () => reject(new Error('Recognition finalization timed out')),
                8000,
              );
              finishTimer.unref();
              if (liveWs.readyState === WebSocket.OPEN)
                liveWs.send(JSON.stringify({ type: 'CloseStream' }));
              else if (liveWs.readyState !== WebSocket.CONNECTING)
                reject(new Error('Recognition unavailable'));
            });
            return finishPromise;
          },
          close: () => {
            clearInterval(keepAlive);
            clearTimeout(finishTimer);
            finishReject?.(new Error('Recording cancelled'));
            pendingAudio.length = 0;
            events.complete();
            try {
              if (liveWs.readyState === WebSocket.OPEN) {
                liveWs.send(JSON.stringify({ type: 'CloseStream' }));
                const timer = setTimeout(() => {
                  try {
                    liveWs.close();
                  } catch {
                    // ignore close error
                  }
                }, 500);
                timer.unref();
              } else if (liveWs.readyState === WebSocket.CONNECTING) {
                liveWs.close();
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

    const isProduction =
      process.env.NODE_ENV === 'production' ||
      this.configService.get<string>('app.env') === 'production' ||
      this.configService.get<string>('NODE_ENV') === 'production';
    const allowMock =
      process.env.ALLOW_MOCK_PROVIDERS === 'true' ||
      this.configService.get<boolean>('ALLOW_MOCK_PROVIDERS') === true;

    if (isProduction && !allowMock && !this.isConfigured) {
      this.logger.error(
        'Deepgram STT is not configured in production and ALLOW_MOCK_PROVIDERS is not set',
      );
      throw new DomainException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Voice Speech-to-Text service is currently unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let hasSentAudio = false;
    return {
      sendAudioChunk: () => {
        hasSentAudio = true;
      },
      events,
      close: () => {
        if (hasSentAudio && !this.isConfigured) {
          events.next({
            text: 'I would structure the microservices architecture using event-driven communication.',
            isFinal: true,
            confidence: 0.95,
          });
        }
        events.complete();
      },
    };
  }
}
