import { Injectable, Logger } from '@nestjs/common';

export interface VoiceStreamChunk {
  audioBuffer: Buffer;
  isFinal: boolean;
  transcript?: string;
}

@Injectable()
export class MockVoiceProvider {
  private readonly logger = new Logger(MockVoiceProvider.name);

  /**
   * Generates deterministic mock STT transcript based on candidate's audio activity
   */
  async transcribeAudio(audioBytes: Buffer, turnNumber = 1): Promise<string> {
    if (!audioBytes || audioBytes.length === 0) {
      return 'I would structure the architecture using a message broker with idempotent consumer handlers.';
    }

    const byteLen = audioBytes.length;
    if (byteLen < 5000) {
      return 'Yes, I understand the requirements.';
    }

    if (turnNumber === 1) {
      return 'In Node.js, asynchronous I/O is offloaded to libuv thread pool, while Javascript execution runs on the single event loop thread.';
    }

    if (turnNumber === 2) {
      return 'For database sharding, we can use consistent hashing on user ID with virtual nodes to balance partitions evenly across nodes.';
    }

    return 'We should use exponential backoff retry with jitter, circuit breaking with Sentinel, and rate limiting at the API gateway layer.';
  }

  /**
   * Synthesizes mock PCM16 audio chunks for AI interviewer voice streaming
   */
  generateMockAudioChunks(
    text: string,
    onChunk: (chunk: Buffer, isLast: boolean) => void,
    onCancelled?: () => boolean,
  ): Promise<void> {
    return new Promise(resolve => {
      const words = text.split(' ');
      const totalChunks = Math.min(20, Math.max(5, words.length));
      let currentChunk = 0;

      const interval = setInterval(() => {
        if (onCancelled && onCancelled()) {
          clearInterval(interval);
          this.logger.log('Mock audio synthesis cancelled due to barge-in interrupt.');
          resolve();
          return;
        }

        currentChunk++;
        const isLast = currentChunk >= totalChunks;

        // Generate 640 bytes (20ms of 16kHz 16-bit mono audio) simulated sine wave
        const pcm = Buffer.alloc(640);
        for (let i = 0; i < 320; i++) {
          const sample = Math.sin((i / 320) * Math.PI * 2 * 440) * 8000;
          pcm.writeInt16LE(Math.round(sample), i * 2);
        }

        onChunk(pcm, isLast);

        if (isLast) {
          clearInterval(interval);
          resolve();
        }
      }, 50); // 50ms chunk emission
    });
  }
}
