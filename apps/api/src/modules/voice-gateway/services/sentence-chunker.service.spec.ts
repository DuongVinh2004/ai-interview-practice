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
  });
});
