import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SentenceChunkerService {
  private readonly logger = new Logger(SentenceChunkerService.name);

  /**
   * Splits a streaming token sequence into complete sentence chunks for TTS delivery.
   */
  async processTokenStream(
    tokenStream: AsyncIterable<string>,
    onSentence: (sentence: string) => void,
    isCancelled?: () => boolean,
  ): Promise<string> {
    let buffer = '';
    let fullResponse = '';
    const sentenceEndRegex = /[.?!;:\n]/;

    for await (const token of tokenStream) {
      if (isCancelled && isCancelled()) {
        this.logger.log('Sentence chunker aborted due to stream cancellation');
        break;
      }

      buffer += token;
      fullResponse += token;

      let match = buffer.match(sentenceEndRegex);
      while (match && match.index !== undefined) {
        const splitIndex = match.index + 1;
        const sentence = buffer.slice(0, splitIndex).trim();

        if (sentence.length > 0) {
          onSentence(sentence);
        }

        buffer = buffer.slice(splitIndex).trimStart();
        match = buffer.match(sentenceEndRegex);
      }
    }

    // Flush any remaining text in buffer if not cancelled
    if (buffer.trim().length > 0 && (!isCancelled || !isCancelled())) {
      onSentence(buffer.trim());
    }

    return fullResponse;
  }

  /**
   * Synchronously segments a full text into sentences (utility function)
   */
  segmentText(text: string): string[] {
    if (!text || text.trim() === '') return [];
    const sentences = text
      .split(/(?<=[.?!;:\n])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    return sentences.length > 0 ? sentences : [text.trim()];
  }
}
