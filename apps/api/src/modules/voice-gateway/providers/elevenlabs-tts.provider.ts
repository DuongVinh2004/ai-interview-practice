import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { Subject } from 'rxjs';
import { speechParts } from '../services/speech-pronunciation';
import { TtsStreamSession } from '../interfaces/voice-provider.interface';
import { ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

@Injectable()
export class ElevenLabsTtsProvider {
  private readonly logger = new Logger(ElevenLabsTtsProvider.name);
  private readonly apiKey: string;
  private readonly defaultVoiceId: string;
  private readonly isConfigured: boolean;
  private readonly deepgramApiKey: string;
  private readonly ttsProvider: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('voice.elevenlabsApiKey') ||
      process.env.ELEVENLABS_API_KEY ||
      '';
    this.defaultVoiceId =
      this.configService.get<string>('voice.elevenlabsVoiceId') ||
      process.env.ELEVENLABS_VOICE_ID ||
      '21m00Tcm4TlvDq8ikWAM'; // Rachel default
    this.deepgramApiKey =
      this.configService.get<string>('voice.deepgramApiKey') || process.env.DEEPGRAM_API_KEY || '';
    this.ttsProvider =
      this.configService.get<string>('voice.ttsProvider') ||
      process.env.VOICE_TTS_PROVIDER ||
      'deepgram';
    this.isConfigured = !!this.apiKey && !this.apiKey.includes('mock');
  }

  isPaidConfigured(): boolean {
    return this.isConfigured || (!!this.deepgramApiKey && !this.deepgramApiKey.includes('mock'));
  }

  createStreamingSession(voiceId: string = this.defaultVoiceId, language = 'en'): TtsStreamSession {
    const audioStream = new Subject<Buffer>();
    const isEnglish = language.toLowerCase().startsWith('en');
    const routerKey = this.configService.get<string>('ai.ninerouterKey');
    if (routerKey && (this.ttsProvider === 'ninerouter' || !isEnglish)) {
      return this.createRouterSession(audioStream, language, routerKey);
    }
    if (!isEnglish && !this.isConfigured && this.isPaidConfigured()) {
      throw new Error(
        'Vietnamese voice synthesis requires ElevenLabs configuration. Please continue with text.',
      );
    }

    // 1. If Deepgram is selected or ElevenLabs is unconfigured, stream via Deepgram Aura
    if (
      this.ttsProvider === 'deepgram' &&
      isEnglish &&
      this.deepgramApiKey &&
      !this.deepgramApiKey.includes('mock')
    ) {
      return this.createDeepgramStreamingSession(audioStream);
    }

    // 2. ElevenLabs with sentence queueing and Deepgram/Mock fallback on auth/network failure
    if (this.isConfigured) {
      let isFallbackTriggered = false;
      let isClosed = false;
      let flushRequested = false;
      let fallbackSession: TtsStreamSession | undefined;
      let textDispatched = false;
      const pendingTextQueue: string[] = [];
      let ws: WebSocket | null = null;

      try {
        const model = 'eleven_turbo_v2_5';
        const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${model}&output_format=pcm_24000`;

        ws = new WebSocket(wsUrl, {
          headers: {
            'xi-api-key': this.apiKey,
          },
        });

        ws.on('open', () => {
          this.logger.log(`Connected to ElevenLabs WebSocket for voice ${voiceId}`);
          ws!.send(
            JSON.stringify({
              text: ' ',
              voice_settings: { stability: 0.5, similarity_boost: 0.8 },
              generation_config: { chunk_length_schedule: [120, 160, 250, 290] },
            }),
          );
          while (pendingTextQueue.length > 0 && !isClosed) {
            textDispatched = true;
            const sentence = pendingTextQueue.shift()!;
            ws!.send(
              JSON.stringify({
                text: `${sentence} `,
                try_trigger_generation: true,
              }),
            );
          }
          if (flushRequested && !isClosed) ws!.send(JSON.stringify({ text: '' }));
        });

        ws.on('message', (data: WebSocket.Data) => {
          try {
            const parsed = JSON.parse(data.toString());
            if (parsed.audio) {
              const audioBuffer = Buffer.from(parsed.audio, 'base64');
              audioStream.next(audioBuffer);
            }
            if (parsed.isFinal) {
              this.logger.log('ElevenLabs stream generation completed.');
              audioStream.complete();
              ws?.close();
            }
          } catch (e: any) {
            this.logger.error(`Error parsing ElevenLabs audio response: ${e.message}`);
          }
        });

        const triggerFallback = (reason: string) => {
          if (isFallbackTriggered || isClosed) return;
          isFallbackTriggered = true;
          this.logger.warn(`ElevenLabs TTS unavailable (${reason}); checking eligible fallback.`);
          try {
            ws?.close();
          } catch {
            // ignore close error
          }

          if (
            !isEnglish ||
            textDispatched ||
            !this.deepgramApiKey ||
            this.deepgramApiKey.includes('mock')
          ) {
            audioStream.error(new Error(`Voice synthesis unavailable: ${reason}`));
            return;
          }
          fallbackSession = this.createDeepgramStreamingSession(audioStream);

          while (pendingTextQueue.length > 0) {
            fallbackSession.sendText(pendingTextQueue.shift()!);
          }
          fallbackSession.flush();
        };

        ws.on('error', (err: any) => {
          this.logger.error(`ElevenLabs WebSocket error: ${err.message}`);
          triggerFallback(err.message);
        });

        ws.on('close', (code: number) => {
          if (code === 401 || code === 1008 || code >= 4000) {
            triggerFallback(`closed with code ${code}`);
          } else if (!isFallbackTriggered) {
            audioStream.complete();
          }
        });

        return {
          sendText: (text: string) => {
            if (isClosed || isFallbackTriggered) return;
            if (ws && ws.readyState === WebSocket.OPEN) {
              textDispatched = true;
              ws.send(
                JSON.stringify({
                  text: `${text} `,
                  try_trigger_generation: true,
                }),
              );
            } else {
              pendingTextQueue.push(text);
            }
          },
          audioStream,
          flush: () => {
            flushRequested = true;
            if (isClosed || isFallbackTriggered) return;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ text: '' }));
            }
          },
          close: () => {
            isClosed = true;
            fallbackSession?.close();
            audioStream.complete();
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ text: '' }));
              const closeTimer = setTimeout(() => ws?.close(), 500);
              closeTimer.unref();
            } else {
              ws?.close();
            }
          },
        };
      } catch (err: any) {
        this.logger.error(`Failed to initiate ElevenLabs WS connection: ${err.message}`);
      }
    }

    // 3. Fallback to Deepgram Aura TTS
    if (this.deepgramApiKey && !this.deepgramApiKey.includes('mock')) {
      return this.createDeepgramStreamingSession(audioStream);
    }

    const isProduction =
      process.env.NODE_ENV === 'production' ||
      this.configService.get<string>('app.env') === 'production' ||
      this.configService.get<string>('NODE_ENV') === 'production';
    const allowMock =
      process.env.ALLOW_MOCK_PROVIDERS === 'true' ||
      this.configService.get<boolean>('ALLOW_MOCK_PROVIDERS') === true;

    if (isProduction && !allowMock && !this.isConfigured && !this.deepgramApiKey) {
      this.logger.error(
        'ElevenLabs TTS is not configured in production and ALLOW_MOCK_PROVIDERS is not set',
      );
      throw new DomainException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Voice Text-to-Speech service is currently unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // 4. Mock TTS Stream Fallback for non-production environments
    return this.createMockStreamingSession(audioStream);
  }

  private createRouterSession(
    audioStream: Subject<Buffer>,
    language: string,
    key: string,
  ): TtsStreamSession {
    const controller = new AbortController();
    const parts: string[] = [];
    let closed = false;
    let flushed = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return {
      codec: 'mp3',
      audioStream,
      sendText: text => {
        if (!closed && !flushed) parts.push(text);
      },
      flush: () => {
        if (closed || flushed) return;
        flushed = true;
        timeout = setTimeout(() => controller.abort(), 60000);
        timeout.unref();
        void (async () => {
          try {
            const base =
              this.configService.get<string>('ai.ninerouterUrl') || 'http://localhost:20128';
            for (const part of speechParts(parts.join(' '), language)) {
              if (closed) return;
              const model =
                part.language === 'vi'
                  ? this.configService.get<string>('ai.ninerouterTtsModel') ||
                    'edge-tts/vi-VN-HoaiMyNeural'
                  : 'edge-tts/en-US-AriaNeural';
              const response = await fetch(`${base.replace(/\/+$/, '')}/v1/audio/speech`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, input: part.text, response_format: 'mp3' }),
                signal: controller.signal,
              });
              if (!response.ok)
                throw new Error(`Vietnamese TTS unavailable (HTTP ${response.status}).`);
              const buffer = Buffer.from(await response.arrayBuffer());
              if (!buffer.length) throw new Error('Voice provider returned no audio.');
              if (!closed) {
                audioStream.next(buffer);
              }
            }
            if (!closed) audioStream.complete();
          } catch (error) {
            if (!closed) audioStream.error(error);
          } finally {
            if (timeout) clearTimeout(timeout);
          }
        })();
      },
      close: () => {
        closed = true;
        if (timeout) clearTimeout(timeout);
        controller.abort();
        audioStream.complete();
      },
    };
  }

  private createDeepgramStreamingSession(audioStream: Subject<Buffer>): TtsStreamSession {
    let isClosed = false;
    let isFlushed = false;
    let isProcessing = false;
    const abortController = new AbortController();
    const sentenceQueue: string[] = [];

    const processQueue = async () => {
      if (isProcessing) return;
      isProcessing = true;

      while (sentenceQueue.length > 0 && !isClosed) {
        const text = sentenceQueue.shift()!;
        if (!text.trim()) continue;

        try {
          const res = await fetch(
            'https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=linear16&sample_rate=24000&container=none',
            {
              method: 'POST',
              headers: {
                Authorization: `Token ${this.deepgramApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text }),
              signal: abortController.signal,
            },
          );

          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            this.logger.error(`Deepgram Aura TTS HTTP error ${res.status}: ${errText}`);
            throw new Error(`Voice synthesis failed (${res.status})`);
          }

          if (res.body) {
            const reader = res.body.getReader();
            let remainder = Buffer.alloc(0);
            let isFirstChunk = true;
            while (!isClosed) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value && value.length > 0) {
                let chunk = Buffer.from(value);
                if (remainder.length) chunk = Buffer.concat([remainder, chunk]);
                const alignedLength = chunk.length - (chunk.length % 2);
                remainder = chunk.subarray(alignedLength);
                chunk = chunk.subarray(0, alignedLength);
                if (isFirstChunk) {
                  isFirstChunk = false;
                  if (chunk.length >= 44 && chunk.subarray(0, 4).toString('ascii') === 'RIFF') {
                    chunk = chunk.subarray(44);
                  }
                }
                if (chunk.length > 0) {
                  audioStream.next(chunk);
                }
              }
            }
          }
        } catch (err: any) {
          this.logger.error(`Deepgram Aura TTS stream error: ${err.message}`);
          audioStream.error(err);
          isClosed = true;
        }
      }

      isProcessing = false;
      if (isFlushed && sentenceQueue.length === 0 && !isClosed) {
        audioStream.complete();
      }
    };

    return {
      sendText: (text: string) => {
        if (isClosed || !text.trim()) return;
        sentenceQueue.push(text);
        void processQueue();
      },
      audioStream,
      flush: () => {
        isFlushed = true;
        if (!isProcessing && sentenceQueue.length === 0) {
          audioStream.complete();
        }
      },
      close: () => {
        isClosed = true;
        abortController.abort();
        sentenceQueue.length = 0;
        audioStream.complete();
      },
    };
  }

  private createMockStreamingSession(audioStream: Subject<Buffer>): TtsStreamSession {
    let isClosed = false;
    let pendingChunks = 0;
    let flushed = false;

    return {
      sendText: (text: string) => {
        if (isClosed || !text.trim()) return;

        const words = text.trim().split(/\s+/);
        const chunkCount = Math.max(2, Math.min(10, words.length * 2));

        for (let i = 0; i < chunkCount; i++) {
          pendingChunks++;
          const chunkTimer = setTimeout(() => {
            if (isClosed) return;
            const pcm = Buffer.alloc(640); // 20ms @ 16kHz 16-bit
            for (let j = 0; j < 320; j++) {
              const sample = Math.sin((j / 320) * Math.PI * 2 * 440) * 8000;
              pcm.writeInt16LE(Math.round(sample), j * 2);
            }
            audioStream.next(pcm);
            pendingChunks--;
            if (flushed && pendingChunks === 0) audioStream.complete();
          }, i * 40);
          chunkTimer.unref();
        }
      },
      audioStream,
      flush: () => {
        flushed = true;
        if (pendingChunks === 0) audioStream.complete();
      },
      close: () => {
        isClosed = true;
        audioStream.complete();
      },
    };
  }
}
