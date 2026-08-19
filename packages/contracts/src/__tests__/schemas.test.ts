import { describe, it, expect } from 'vitest';
import {
  RegisterDtoSchema,
  CreateInterviewDtoSchema,
  SubmitAnswerDtoSchema,
  EvaluatedAnswerAiSchema,
  SessionState,
} from '../index';

describe('Contracts Validation Schemas', () => {
  it('validates RegisterDto correctly', () => {
    const valid = RegisterDtoSchema.safeParse({
      email: 'test@example.com',
      password: 'Password123',
      fullName: 'John Doe',
    });
    expect(valid.success).toBe(true);

    const invalid = RegisterDtoSchema.safeParse({
      email: 'invalid-email',
      password: 'weak',
      fullName: '',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates CreateInterviewDto correctly', () => {
    const valid = CreateInterviewDtoSchema.safeParse({
      jobRoleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      seniorityLevelId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      technologyIds: ['c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
    });
    expect(valid.success).toBe(true);

    const emptyTechs = CreateInterviewDtoSchema.safeParse({
      jobRoleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      seniorityLevelId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      technologyIds: [],
    });
    expect(emptyTechs.success).toBe(false);
  });

  it('validates SubmitAnswerDto with character limits', () => {
    const valid = SubmitAnswerDtoSchema.safeParse({
      turnId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      answerText:
        'A React hook is a special function that lets you use state and other React features.',
    });
    expect(valid.success).toBe(true);

    const empty = SubmitAnswerDtoSchema.safeParse({
      turnId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      answerText: '   ',
    });
    expect(empty.success).toBe(false);

    const tooLong = SubmitAnswerDtoSchema.safeParse({
      turnId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      answerText: 'a'.repeat(5001),
    });
    expect(tooLong.success).toBe(false);
  });

  it('validates AI evaluation schema correctly', () => {
    const valid = EvaluatedAnswerAiSchema.safeParse({
      score: 8.5,
      rubricScores: {
        technicalAccuracy: 9,
        depth: 8,
        clarity: 8.5,
      },
      strengths: ['Clear explanation of useEffect lifecycle'],
      improvements: ['Could mention cleanup return function'],
      conciseFeedback: 'Strong answer demonstrating solid React knowledge.',
      evidence: ['"lets you use state"'],
    });
    expect(valid.success).toBe(true);
  });

  it('exports SessionState enum correctly', () => {
    expect(SessionState.CREATED).toBe('CREATED');
    expect(SessionState.ACTIVE).toBe('ACTIVE');
    expect(SessionState.EVALUATING).toBe('EVALUATING');
    expect(SessionState.COMPLETED).toBe('COMPLETED');
  });
});
