import { SentenceChunkerService } from './sentence-chunker.service';

describe('SentenceChunkerService (Module B3)', () => {
  let chunker: SentenceChunkerService;

  beforeEach(() => {
    chunker = new SentenceChunkerService();
  });

  describe('segmentText', () => {
    it('segments text by periods, exclamation points, question marks, and newlines', () => {
      const input = 'Hello world. How are you today? I am doing great! Let us begin our session.';
      const sentences = chunker.segmentText(input);

      expect(sentences).toHaveLength(4);
      expect(sentences[0]).toBe('Hello world.');
      expect(sentences[1]).toBe('How are you today?');
      expect(sentences[2]).toBe('I am doing great!');
      expect(sentences[3]).toBe('Let us begin our session.');
    });

    it('handles text without ending punctuation', () => {
      const input = 'Single sentence without period';
      const sentences = chunker.segmentText(input);
      expect(sentences).toEqual(['Single sentence without period']);
    });

    it('handles empty text', () => {
      expect(chunker.segmentText('')).toEqual([]);
      expect(chunker.segmentText('   ')).toEqual([]);
    });

    it('does not split on decimal numbers like 3.14 or 2.0', () => {
      const input = 'Version 2.0 was released with 99.9% uptime. Next feature is ready.';
      const sentences = chunker.segmentText(input);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Version 2.0 was released with 99.9% uptime.');
      expect(sentences[1]).toBe('Next feature is ready.');
    });

    it('does not split on common abbreviations like e.g., i.e., Dr., or v.v.', () => {
      const input = 'Use a container, e.g. Docker for deployment. It scales well.';
      const sentences = chunker.segmentText(input);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Use a container, e.g. Docker for deployment.');
      expect(sentences[1]).toBe('It scales well.');
    });

    it('handles ellipsis without breaking into orphan dots', () => {
      const input = 'Wait... let me think. Yes, that is correct!';
      const sentences = chunker.segmentText(input);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Wait... let me think.');
      expect(sentences[1]).toBe('Yes, that is correct!');
    });

    it('splits on newlines as natural sentence boundaries', () => {
      const input = 'First line\nSecond line\nThird line.';
      const sentences = chunker.segmentText(input);
      expect(sentences).toHaveLength(3);
      expect(sentences[0]).toBe('First line');
      expect(sentences[1]).toBe('Second line');
      expect(sentences[2]).toBe('Third line.');
    });
  });

  describe('processTokenStream', () => {
    it('emits sentences as soon as sentence delimiters arrive in stream', async () => {
      const tokens = [
        'Welcome',
        ' to',
        ' your',
        ' interview',
        '.',
        ' Today',
        ' we',
        ' discuss',
        ' Kafka',
        '!',
      ];

      async function* tokenGenerator() {
        for (const token of tokens) {
          yield token;
        }
      }

      const receivedSentences: string[] = [];
      const fullText = await chunker.processTokenStream(tokenGenerator(), sentence => {
        receivedSentences.push(sentence);
      });

      expect(receivedSentences).toHaveLength(2);
      expect(receivedSentences[0]).toBe('Welcome to your interview.');
      expect(receivedSentences[1]).toBe('Today we discuss Kafka!');
      expect(fullText).toBe('Welcome to your interview. Today we discuss Kafka!');
    });

    it('preserves decimal numbers during token streaming', async () => {
      const tokens = [
        'The',
        ' price',
        ' is',
        ' $3.14',
        ' per',
        ' item',
        '.',
        ' Thank',
        ' you',
        '!',
      ];

      async function* tokenGenerator() {
        for (const token of tokens) {
          yield token;
        }
      }

      const receivedSentences: string[] = [];
      await chunker.processTokenStream(tokenGenerator(), sentence => {
        receivedSentences.push(sentence);
      });

      expect(receivedSentences).toHaveLength(2);
      expect(receivedSentences[0]).toBe('The price is $3.14 per item.');
      expect(receivedSentences[1]).toBe('Thank you!');
    });

    it('handles ellipsis in token stream without producing single dot sentences', async () => {
      const tokens = ['Thinking', '...', ' found', ' the', ' answer', '.'];

      async function* tokenGenerator() {
        for (const token of tokens) {
          yield token;
        }
      }

      const receivedSentences: string[] = [];
      await chunker.processTokenStream(tokenGenerator(), sentence => {
        receivedSentences.push(sentence);
      });

      expect(receivedSentences.every(s => s !== '.' && s !== '..')).toBe(true);
      expect(receivedSentences[0]).toContain('Thinking...');
    });

    it('respects cancellation flag immediately', async () => {
      const tokens = [
        'First',
        ' sentence',
        '.',
        ' Second',
        ' sentence',
        '.',
        ' Third',
        ' sentence',
        '.',
      ];
      let cancelled = false;

      async function* tokenGenerator() {
        for (const token of tokens) {
          if (token === ' Second') cancelled = true;
          yield token;
        }
      }

      const receivedSentences: string[] = [];
      await chunker.processTokenStream(
        tokenGenerator(),
        sentence => {
          receivedSentences.push(sentence);
        },
        () => cancelled,
      );

      expect(receivedSentences).toHaveLength(1);
      expect(receivedSentences[0]).toBe('First sentence.');
    });

    it('createChunker returns an executable function matching Plan B3 spec', async () => {
      const tokens = ['Hello', ' world', '.', ' Ready', '?'];

      async function* tokenGenerator() {
        for (const token of tokens) {
          yield token;
        }
      }

      const received: string[] = [];
      const runner = chunker.createChunker(tokenGenerator(), s => received.push(s));
      await runner();

      expect(received).toEqual(['Hello world.', 'Ready?']);
    });
  });
});
