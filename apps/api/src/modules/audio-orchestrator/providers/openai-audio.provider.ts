import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';
import {
  AudioProviderInterface,
  AudioSttResult,
  AudioTtsResult,
} from '../interfaces/audio-provider.interface';
import { AudioVoice, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

@Injectable()
export class OpenAiAudioProvider implements AudioProviderInterface {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAiAudioProvider.name);
  private client: OpenAI | null = null;
  private readonly sttModel = 'whisper-1';
  private readonly ttsModel = 'tts-1';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ai.openaiApiKey', '');
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('ai.openaiApiKey', '');
      if (!apiKey) {
        throw new DomainException(
          ErrorCode.AUDIO_TRANSCRIPTION_FAILED,
          'OpenAI API key is not configured for audio operations.',
          401,
        );
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async transcribe(
    audioBuffer: Buffer,
    mimeType: string = 'audio/webm',
    filename: string = 'audio.webm',
    language?: string,
  ): Promise<AudioSttResult> {
    const startTime = Date.now();
    const client = this.getClient();

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Audio buffer cannot be empty for transcription.',
        400,
      );
    }

    try {
      const file = await toFile(audioBuffer, filename, { type: mimeType });

      const response = await client.audio.transcriptions.create({
        file,
        model: this.sttModel,
        language: language === 'vi' ? 'vi' : language === 'en' ? 'en' : undefined,
        response_format: 'verbose_json',
      });

      const latencyMs = Date.now() - startTime;
      const durationSeconds = (response as any).duration || Math.max(1, Math.round(audioBuffer.length / 16000));
      // OpenAI Whisper cost: $0.006 per minute = $0.0001 per second
      const costEstimate = Number(((durationSeconds / 60) * 0.006).toFixed(6));

      return {
        text: response.text.trim(),
        confidence: 0.98,
        durationSeconds,
        detectedLanguage: (response as any).language || language || 'en',
        provider: this.name,
        model: this.sttModel,
        latencyMs,
        costEstimate,
      };
    } catch (error: any) {
      this.logger.error(`OpenAI STT failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AUDIO_TRANSCRIPTION_FAILED,
        `Whisper audio transcription failed: ${error.message}`,
        error.status || 500,
      );
    }
  }

  async synthesize(
    text: string,
    voice: AudioVoice = AudioVoice.ALLOY,
    speed: number = 1.0,
  ): Promise<AudioTtsResult> {
    const startTime = Date.now();
    const client = this.getClient();

    if (!text || text.trim().length === 0) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Synthesis text cannot be empty.',
        400,
      );
    }

    try {
      const response = await client.audio.speech.create({
        model: this.ttsModel,
        voice: (voice as any) || 'alloy',
        input: text,
        speed: speed || 1.0,
        response_format: 'mp3',
      });

      const latencyMs = Date.now() - startTime;
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      // OpenAI TTS-1 cost: $0.015 per 1,000 characters
      const costEstimate = Number(((text.length / 1000) * 0.015).toFixed(6));
      const estimatedDuration = Math.max(1, Math.round(text.length / 15));

      return {
        audioBuffer,
        mimeType: 'audio/mpeg',
        durationSeconds: estimatedDuration,
        provider: this.name,
        model: this.ttsModel,
        latencyMs,
        costEstimate,
      };
    } catch (error: any) {
      this.logger.error(`OpenAI TTS failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AUDIO_SYNTHESIS_FAILED,
        `OpenAI speech synthesis failed: ${error.message}`,
        error.status || 500,
      );
    }
  }
}
