import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { Subject } from 'rxjs';
import { TtsStreamSession } from '../interfaces/voice-provider.interface';

@Injectable()
export class ElevenLabsTtsProvider {
  private readonly logger = new Logger(ElevenLabsTtsProvider.name);
  private readonly apiKey: string;
  private readonly defaultVoiceId: string;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('voice.elevenlabsApiKey') ||
      process.env.ELEVENLABS_API_KEY ||
      '';
    this.defaultVoiceId =
      this.configService.get<string>('voice.elevenlabsVoiceId') ||
      process.env.ELEVENLABS_VOICE_ID ||
      '21m00Tcm4TlvDq8ikWAM'; // Rachel default
    this.isConfigured = !!this.apiKey && !this.apiKey.includes('mock');
  }

  createStreamingSession(voiceId: string = this.defaultVoiceId): TtsStreamSession {
    const audioStream = new Subject<Buffer>();

    if (this.isConfigured) {
      try {
        const model = 'eleven_turbo_v2_5';
        const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${model}&output_format=pcm_16000`;

        const ws = new WebSocket(wsUrl, {
          headers: {
            'xi-api-key': this.apiKey,
          },
        });

        ws.on('open', () => {
          this.logger.log(`Connected to ElevenLabs WebSocket for voice ${voiceId}`);
          ws.send(
            JSON.stringify({
              text: ' ',
              voice_settings: { stability: 0.5, similarity_boost: 0.8 },
              generation_config: { chunk_length_schedule: [120, 160, 250, 290] },
            }),
          );
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
            }
          } catch (e: any) {
            this.logger.error(`Error parsing ElevenLabs audio response: ${e.message}`);
          }
        });

        ws.on('error', (err: any) => {
          this.logger.error(`ElevenLabs WebSocket error: ${err.message}`);
        });

        ws.on('close', () => {
          audioStream.complete();
        });

        return {
          sendText: (text: string) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  text: `${text} `,
                  try_trigger_generation: true,
                }),
              );
            }
          },
          audioStream,
          flush: () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ text: '' }));
            }
          },
          close: () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ text: '' }));
              setTimeout(() => ws.close(), 500);
            }
          },
        };
      } catch (err: any) {
        this.logger.error(`Failed to initiate ElevenLabs WS connection: ${err.message}`);
      }
    }

    // Mock TTS Stream Fallback
    let isClosed = false;

    return {
      sendText: (text: string) => {
        if (isClosed || !text.trim()) return;

        // Generate synthetic PCM16 mono chunks representing spoken words
        const words = text.trim().split(/\s+/);
        const chunkCount = Math.max(2, Math.min(10, words.length * 2));

        for (let i = 0; i < chunkCount; i++) {
          setTimeout(() => {
            if (isClosed) return;
            const pcm = Buffer.alloc(640); // 20ms @ 16kHz 16-bit
            for (let j = 0; j < 320; j++) {
              const sample = Math.sin((j / 320) * Math.PI * 2 * 440) * 8000;
              pcm.writeInt16LE(Math.round(sample), j * 2);
            }
            audioStream.next(pcm);
          }, i * 40);
        }
      },
      audioStream,
      flush: () => {
        // No-op for mock
      },
      close: () => {
        isClosed = true;
        audioStream.complete();
      },
    };
  }
}
