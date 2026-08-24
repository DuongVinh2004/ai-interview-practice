import { Injectable, Logger } from '@nestjs/common';
import {
  AudioProviderInterface,
  AudioSttResult,
  AudioTtsResult,
} from '../interfaces/audio-provider.interface';
import { AudioVoice, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

@Injectable()
export class MockAudioProvider implements AudioProviderInterface {
  readonly name = 'mock';
  private readonly logger = new Logger(MockAudioProvider.name);

  async transcribe(
    audioBuffer: Buffer,
    _mimeType: string,
    _filename?: string,
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

    const estimatedDuration = Math.max(1, Math.min(60, Math.round(audioBuffer.length / 16000)));

    // Simulated responses based on detected language or length
    const sampleResponsesVi = [
      'Để giải quyết bài toán concurrency trong hệ thống phân tán, tôi thường sử dụng optimistic locking kết hợp với distributed lock trên Redis.',
      'React Virtual DOM tối ưu hiệu năng bằng cách so sánh tree diffing trước khi commit thay đổi lên DOM thực tế.',
      'Tôi thiết kế cơ chế Circuit Breaker với 3 trạng thái: Closed, Open, và Half-Open để bảo vệ downstream services.',
    ];

    const sampleResponsesEn = [
      'To handle high throughput, I recommend database sharding with consistent hashing and read replicas.',
      'In React, useEffect handles side effects while useMemo and useCallback prevent unnecessary re-computations.',
      'We implemented a circuit breaker with sliding window metrics to prevent cascading service failures.',
    ];

    const isVi = language === 'vi' || language === 'vie';
    const pool = isVi ? sampleResponsesVi : sampleResponsesEn;
    const selectedText = pool[audioBuffer.length % pool.length];

    const latencyMs = Date.now() - startTime + 30; // realistic mock latency

    return {
      text: selectedText,
      confidence: 0.96,
      durationSeconds: estimatedDuration,
      detectedLanguage: isVi ? 'vi' : 'en',
      provider: this.name,
      model: 'mock-whisper-v1',
      latencyMs,
      costEstimate: 0.0,
    };
  }

  async synthesize(
    text: string,
    _voice: AudioVoice = AudioVoice.ALLOY,
    _speed: number = 1.0,
  ): Promise<AudioTtsResult> {
    const startTime = Date.now();

    if (!text || text.trim().length === 0) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Synthesis text cannot be empty.',
        400,
      );
    }

    const durationSeconds = Math.max(1, Math.min(30, Math.round(text.length / 15)));
    const sampleRate = 8000;
    const numSamples = sampleRate * durationSeconds;
    const wavBuffer = this.generateSyntheticWavBuffer(numSamples, sampleRate);

    const latencyMs = Date.now() - startTime + 25;

    return {
      audioBuffer: wavBuffer,
      mimeType: 'audio/wav',
      durationSeconds,
      provider: this.name,
      model: 'mock-tts-v1',
      latencyMs,
      costEstimate: 0.0,
    };
  }

  /**
   * Generates a valid, playable 8-bit PCM Mono WAV buffer.
   */
  private generateSyntheticWavBuffer(numSamples: number, sampleRate: number): Buffer {
    const buffer = Buffer.alloc(44 + numSamples);

    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + numSamples, 4);
    buffer.write('WAVE', 8);

    // "fmt " sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(1, 22); // NumChannels (1 = Mono)
    buffer.writeUInt32LE(sampleRate, 24); // SampleRate
    buffer.writeUInt32LE(sampleRate * 1 * 1, 28); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    buffer.writeUInt16LE(1, 32); // BlockAlign (NumChannels * BitsPerSample/8)
    buffer.writeUInt16LE(8, 34); // BitsPerSample (8-bit)

    // "data" sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples, 40);

    // Write a gentle 440Hz sinusoidal audio wave
    const frequency = 440;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const sample = Math.sin(2 * Math.PI * frequency * t);
      // Convert [-1.0, 1.0] to [0, 255] for 8-bit unsigned PCM
      const byteVal = Math.floor((sample + 1) * 127.5);
      buffer.writeUInt8(byteVal, 44 + i);
    }

    return buffer;
  }
}
