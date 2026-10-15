import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AudioProviderInterface,
  AudioSttResult,
  AudioTtsResult,
} from '../interfaces/audio-provider.interface';
import { AudioVoice, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

@Injectable()
export class NineRouterAudioProvider implements AudioProviderInterface {
  readonly name = 'ninerouter';
  private readonly logger = new Logger(NineRouterAudioProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private getBaseUrl(): string {
    const url = this.configService.get<string>('ai.ninerouterUrl', 'http://localhost:20128');
    return url.replace(/\/+$/, '');
  }

  private getApiKey(): string {
    return this.configService.get<string>('ai.ninerouterKey', '');
  }

  private getSttModel(): string {
    return this.configService.get<string>('ai.ninerouterSttModel', 'groq/whisper-large-v3-turbo');
  }

  private getTtsModel(): string {
    return this.configService.get<string>('ai.ninerouterTtsModel', 'edge-tts/vi-VN-HoaiMyNeural');
  }

  private getHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const apiKey = this.getApiKey();
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  async transcribe(
    audioBuffer: Buffer,
    mimeType: string = 'audio/webm',
    filename: string = 'audio.webm',
    language?: string,
  ): Promise<AudioSttResult> {
    const startTime = Date.now();

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Audio buffer cannot be empty for transcription.',
        400,
      );
    }

    const baseUrl = this.getBaseUrl();
    const sttModel = this.getSttModel();

    try {
      const formData = new FormData();
      formData.append('model', sttModel);
      formData.append(
        'file',
        new Blob([new Uint8Array(audioBuffer)], { type: mimeType }),
        filename,
      );
      if (language) {
        formData.append('language', language);
      }
      formData.append('response_format', 'verbose_json');

      const headers = this.getHeaders();
      const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new DomainException(
          ErrorCode.AUDIO_TRANSCRIPTION_FAILED,
          `9Router STT failed with status ${response.status}: ${errorText}`,
          response.status,
        );
      }

      const data = (await response.json()) as any;
      const latencyMs = Date.now() - startTime;
      const durationSeconds = data.duration || Math.max(1, Math.round(audioBuffer.length / 16000));

      return {
        text: (data.text || '').trim(),
        confidence: 0.98,
        durationSeconds,
        detectedLanguage: data.language || language || 'en',
        provider: this.name,
        model: sttModel,
        latencyMs,
        costEstimate: 0,
      };
    } catch (error: any) {
      this.logger.error(`9Router STT failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AUDIO_TRANSCRIPTION_FAILED,
        `9Router audio transcription failed: ${error.message}`,
        error.status || 500,
      );
    }
  }

  async synthesize(text: string, voice?: AudioVoice, speed: number = 1.0): Promise<AudioTtsResult> {
    const startTime = Date.now();

    if (!text || text.trim().length === 0) {
      throw new DomainException(ErrorCode.VALIDATION_ERROR, 'Synthesis text cannot be empty.', 400);
    }

    const baseUrl = this.getBaseUrl();
    const ttsModel = this.getTtsModel();

    try {
      const headers = this.getHeaders('application/json');
      const payload: Record<string, any> = {
        model: ttsModel,
        input: text,
      };
      if (speed && speed !== 1.0) {
        payload.speed = speed;
      }

      const response = await fetch(`${baseUrl}/v1/audio/speech`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new DomainException(
          ErrorCode.AUDIO_SYNTHESIS_FAILED,
          `9Router TTS failed with status ${response.status}: ${errorText}`,
          response.status,
        );
      }

      const latencyMs = Date.now() - startTime;
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);
      const estimatedDuration = Math.max(1, Math.round(text.length / 15));

      return {
        audioBuffer,
        mimeType: 'audio/mpeg',
        durationSeconds: estimatedDuration,
        provider: this.name,
        model: ttsModel,
        latencyMs,
        costEstimate: 0,
      };
    } catch (error: any) {
      this.logger.error(`9Router TTS failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AUDIO_SYNTHESIS_FAILED,
        `9Router speech synthesis failed: ${error.message}`,
        error.status || 500,
      );
    }
  }
}
