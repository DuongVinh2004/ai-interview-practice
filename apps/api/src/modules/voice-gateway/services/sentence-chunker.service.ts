import { Injectable, Logger } from '@nestjs/common';

const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'vs',
  'etc',
  'eg',
  'ie',
  'vv',
]);

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

    for await (const token of tokenStream) {
      if (isCancelled && isCancelled()) {
        this.logger.log('Sentence chunker aborted due to stream cancellation');
        break;
      }

      buffer += token;
      fullResponse += token;

      // Extract all complete sentences from buffer.
      // A boundary is either:
      // 1) newline (\n+)
      // 2) punctuation followed by whitespace or buffer end
      const boundaryRegex = /(\n+)|([.?!;:]+)(\s+|$)/g;
      let boundaryMatch: RegExpExecArray | null;

      while ((boundaryMatch = boundaryRegex.exec(buffer)) !== null) {
        const isNewline = Boolean(boundaryMatch[1]);
        const punc = boundaryMatch[1] || boundaryMatch[2];
        const matchIndex = boundaryMatch.index;
        const endOfPunc = isNewline ? matchIndex : matchIndex + punc.length;
        const isAtBufferEnd =
          boundaryRegex.lastIndex === buffer.length && !boundaryMatch[3]?.trim();

        if (!isNewline) {
          // If at end of buffer, check if it might be a decimal or abbreviation in progress
          if (isAtBufferEnd) {
            if (punc === '.') {
              // Preceded by digit? e.g. "3." -> wait for next token to see if it's "14"
              if (matchIndex > 0 && /\d/.test(buffer[matchIndex - 1])) {
                continue;
              }
              // Preceded by an abbreviation?
              const textBefore = buffer.substring(0, endOfPunc);
              const lastWordMatch = textBefore.match(/([a-zA-Z.]+)\s*$/);
              const lastWord = lastWordMatch
                ? lastWordMatch[1].replace(/\./g, '').toLowerCase()
                : '';
              if (lastWord && ABBREVIATIONS.has(lastWord)) {
                continue;
              }
            } else if (punc.startsWith('..')) {
              // Ellipsis at end of buffer -> wait for next token to see if it continues lowercase
              continue;
            }
          }

          // Skip decimal numbers (e.g. 3.14)
          if (punc === '.' && matchIndex > 0 && matchIndex + 1 < buffer.length) {
            const prev = buffer[matchIndex - 1];
            const next = buffer[matchIndex + 1];
            if (/\d/.test(prev) && /\d/.test(next)) {
              continue;
            }
          }

          // Skip common abbreviations (e.g. Dr., e.g., i.e.)
          const textBefore = buffer.substring(0, endOfPunc);
          const lastWordMatch = textBefore.match(/([a-zA-Z.]+)\s*$/);
          const lastWord = lastWordMatch ? lastWordMatch[1].replace(/\./g, '').toLowerCase() : '';
          if (lastWord && ABBREVIATIONS.has(lastWord) && punc === '.') {
            continue;
          }

          // Skip ellipsis followed by lowercase continuation (mid-sentence pause)
          if (punc.startsWith('..')) {
            const rest = buffer.substring(boundaryRegex.lastIndex);
            const nextNonSpace = rest.match(/\S/);
            if (nextNonSpace && /[a-z]/.test(nextNonSpace[0])) {
              continue;
            }
          }
        }

        const sentence = buffer.substring(0, endOfPunc).trim();
        if (sentence.length > 0) {
          onSentence(sentence);
        }

        buffer = buffer.substring(boundaryRegex.lastIndex).trimStart();
        boundaryRegex.lastIndex = 0;
      }
    }

    // Flush any remaining text in buffer if not cancelled
    if (buffer.trim().length > 0 && (!isCancelled || !isCancelled())) {
      onSentence(buffer.trim());
    }

    return fullResponse;
  }

  /**
   * Functional factory returning an async processor matching Plan B3 specification
   */
  createChunker(
    tokenStream: AsyncIterable<string>,
    onSentence: (sentence: string) => void,
    isCancelled?: () => boolean,
  ): () => Promise<string> {
    return () => this.processTokenStream(tokenStream, onSentence, isCancelled);
  }

  /**
   * Synchronously segments a full text into sentences (utility function)
   */
  segmentText(text: string): string[] {
    if (!text || !text.trim()) return [];

    const cleaned = text.trim();
    const rawSentences: string[] = [];
    let start = 0;

    // Pattern matches newlines or punctuation followed by whitespace or string end
    const boundaryRegex = /(\n+)|([.?!;:]+)(?:\s+|$)/g;
    let match: RegExpExecArray | null;

    while ((match = boundaryRegex.exec(cleaned)) !== null) {
      const isNewline = Boolean(match[1]);
      const punc = match[1] || match[2];
      const matchIndex = match.index;
      const endOfPunc = isNewline ? matchIndex : matchIndex + punc.length;

      if (!isNewline) {
        // Skip common abbreviations
        const textBefore = cleaned.substring(start, endOfPunc);
        const lastWordMatch = textBefore.match(/([a-zA-Z.]+)\s*$/);
        const lastWord = lastWordMatch ? lastWordMatch[1].replace(/\./g, '').toLowerCase() : '';
        if (lastWord && ABBREVIATIONS.has(lastWord) && punc === '.') {
          continue;
        }

        // Skip decimal numbers
        if (punc === '.' && matchIndex > 0 && matchIndex + 1 < cleaned.length) {
          const prevChar = cleaned[matchIndex - 1];
          const nextChar = cleaned[matchIndex + 1];
          if (/\d/.test(prevChar) && /\d/.test(nextChar)) {
            continue;
          }
        }

        // Skip ellipsis followed by lowercase continuation
        if (punc.startsWith('..')) {
          const rest = cleaned.substring(boundaryRegex.lastIndex);
          const nextNonSpace = rest.match(/\S/);
          if (nextNonSpace && /[a-z]/.test(nextNonSpace[0])) {
            continue;
          }
        }
      }

      const sentence = cleaned.substring(start, endOfPunc).trim();
      if (sentence) {
        rawSentences.push(sentence);
      }
      start = boundaryRegex.lastIndex;
    }

    if (start < cleaned.length) {
      const remainder = cleaned.substring(start).trim();
      if (remainder) {
        rawSentences.push(remainder);
      }
    }

    return rawSentences.length > 0 ? rawSentences : [cleaned];
  }
}
