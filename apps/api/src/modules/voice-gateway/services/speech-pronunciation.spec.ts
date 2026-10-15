import { speechParts } from './speech-pronunciation';

describe('Vietnamese technical speech rendering', () => {
  it('groups English phrases and acronyms without altering the question', () => {
    const question = 'Giải thích dependency injection và API trong Next.js.';
    expect(speechParts(question, 'vi')).toEqual([
      { text: 'Giải thích', language: 'vi' },
      { text: 'dependency injection', language: 'en' },
      { text: 'và', language: 'vi' },
      { text: 'A P I', language: 'en' },
      { text: 'trong', language: 'vi' },
      { text: 'Next J S.', language: 'en' },
    ]);
    expect(question).toBe('Giải thích dependency injection và API trong Next.js.');
  });
  it('does not match terms inside other words or route English questions through Vietnamese', () => {
    expect(speechParts('capital và sqlserver', 'vi')).toEqual([
      { text: 'capital và sqlserver', language: 'vi' },
    ]);
    expect(speechParts('Explain API design.', 'en')).toEqual([
      { text: 'Explain API design.', language: 'en' },
    ]);
  });
});
