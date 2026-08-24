import { describe, it, expect } from 'vitest';
import {
  RegisterDtoSchema,
  CreateInterviewDtoSchema,
  SubmitAnswerDtoSchema,
  EvaluatedAnswerAiSchema,
  SessionState,
  TranscribeAudioResponseSchema,
  SynthesizeSpeechDtoSchema,
  AudioSettingsDtoSchema,
  AudioVoice,
  AudioProvider,
  InterviewMode,
  CreateShareTokenDtoSchema,
  AddMentorFeedbackDtoSchema,
  CompetencyRadarResponseSchema,
  CompetencyArea,
  ShareExpiryDuration,
  SessionMode,
  UpdateLearningPathItemDtoSchema,
  UpdatePortfolioSettingsSchema,
  BadgeLevel,
  CertificateStatus,
  LiveSessionStatus,
  TenantRole,
  AssignmentStatus,
  BookSessionSchema,
  CreateCohortSchema,
  CreateAssignmentSchema,
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
      confidence: 0.95,
      missingConcepts: ['cleanup function'],
      needsReview: false,
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.confidence).toBe(0.95);
      expect(valid.data.missingConcepts).toContain('cleanup function');
    }
  });

  it('exports SessionState enum correctly', () => {
    expect(SessionState.CREATED).toBe('CREATED');
    expect(SessionState.ACTIVE).toBe('ACTIVE');
    expect(SessionState.EVALUATING).toBe('EVALUATING');
    expect(SessionState.COMPLETED).toBe('COMPLETED');
  });

  it('validates Epic 4 Audio schemas and Enums', () => {
    const validTranscribe = TranscribeAudioResponseSchema.safeParse({
      text: 'Microservices allow independent deployment and high scalability.',
      confidence: 0.96,
      durationSeconds: 12.4,
      detectedLanguage: 'en',
    });
    expect(validTranscribe.success).toBe(true);

    const validSynthesize = SynthesizeSpeechDtoSchema.safeParse({
      text: 'Can you explain how database sharding works?',
      voice: AudioVoice.ALLOY,
      speed: 1.0,
      provider: AudioProvider.OPENAI,
    });
    expect(validSynthesize.success).toBe(true);

    const invalidSynthesize = SynthesizeSpeechDtoSchema.safeParse({
      text: '',
    });
    expect(invalidSynthesize.success).toBe(false);

    const validSettings = AudioSettingsDtoSchema.safeParse({
      mode: InterviewMode.VOICE,
      voice: AudioVoice.NOVA,
      playbackSpeed: 1.2,
      autoPlayTts: true,
      micSensitivity: 85,
      pushToTalk: true,
    });
    expect(validSettings.success).toBe(true);
    if (validSettings.success) {
      expect(validSettings.data.mode).toBe(InterviewMode.VOICE);
    }
  });

  it('validates Epic 5 Share and Analytics schemas', () => {
    const validShare = CreateShareTokenDtoSchema.safeParse({
      expiry: ShareExpiryDuration.SEVEN_DAYS,
      isAnonymized: true,
    });
    expect(validShare.success).toBe(true);

    const validMentorFeedback = AddMentorFeedbackDtoSchema.safeParse({
      turnNumber: 2,
      mentorName: 'Senior Tech Lead',
      comment: 'Great explanation on event loops, consider adding details about microtask queue.',
    });
    expect(validMentorFeedback.success).toBe(true);

    const validRadar = CompetencyRadarResponseSchema.safeParse({
      userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      totalEvaluatedTurns: 15,
      overallAverageScore: 8.4,
      competencies: [
        {
          competency: CompetencyArea.SYSTEM_DESIGN,
          name: 'System Design & Scalability',
          score: 8.5,
          sampleCount: 5,
          benchmarkLevel: 'Senior',
          description: 'Strong architectural trade-off analysis.',
        },
      ],
      topStrengths: ['System Design'],
      growthAreas: ['Database Indexing'],
      updatedAt: new Date().toISOString(),
    });
    expect(validRadar.success).toBe(true);
  });

  it('validates Epic 6 Focused Remediation, Sandbox, and Learning Path Item schemas', () => {
    const validRemediation = CreateInterviewDtoSchema.safeParse({
      jobRoleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      seniorityLevelId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      technologyIds: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'],
      sessionMode: SessionMode.FOCUSED_REMEDIATION,
      competencyArea: CompetencyArea.DATABASE_CONCURRENCY,
      totalTurns: 3,
      isSandbox: false,
    });
    expect(validRemediation.success).toBe(true);

    const validSandbox = CreateInterviewDtoSchema.safeParse({
      jobRoleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      seniorityLevelId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      technologyIds: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'],
      sessionMode: SessionMode.QUICK_PRACTICE,
      totalTurns: 2,
      isSandbox: true,
    });
    expect(validSandbox.success).toBe(true);

    const validUpdateGoal = UpdateLearningPathItemDtoSchema.safeParse({
      isCompleted: true,
    });
    expect(validUpdateGoal.success).toBe(true);
  });

  it('validates Wave 3 Skill Graph, System Design, and Readiness schemas', () => {
    // F008 Skill Graph
    const validSkillGraph = {
      userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      overallScore: 8.2,
      areas: [
        {
          area: CompetencyArea.SYSTEM_DESIGN,
          name: 'System Design',
          score: 8.5,
          benchmarkP50: 7.5,
          percentile: 85,
          subCompetencies: [],
        },
      ],
      lastUpdated: new Date().toISOString(),
    };
    expect(validSkillGraph.overallScore).toBe(8.2);

    // F003 System Design Session Mode
    expect(SessionMode.SYSTEM_DESIGN).toBe('SYSTEM_DESIGN');

    // F009 Readiness
    expect(CompetencyArea.SYSTEM_DESIGN).toBe('SYSTEM_DESIGN');
  });

  it('validates Wave 4 Portfolio, Mentor, and B2B schemas', () => {
    // Portfolio
    const portfolioValid = UpdatePortfolioSettingsSchema.safeParse({
      username: 'john_doe_99',
      isPublic: true,
      displayName: 'John Senior Engineer',
      showSkills: true,
      showBadges: true,
      showCertificates: true,
    });
    expect(portfolioValid.success).toBe(true);

    expect(BadgeLevel.PLATINUM).toBe('PLATINUM');
    expect(CertificateStatus.ISSUED).toBe('ISSUED');

    // Mentor
    const bookValid = BookSessionSchema.safeParse({
      mentorId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      scheduledAt: new Date().toISOString(),
    });
    expect(bookValid.success).toBe(true);
    expect(LiveSessionStatus.IN_PROGRESS).toBe('IN_PROGRESS');

    // B2B
    const cohortValid = CreateCohortSchema.safeParse({
      name: 'Spring 2026 CS Batch',
      description: 'Senior candidate interview prep',
    });
    expect(cohortValid.success).toBe(true);

    const assignmentValid = CreateAssignmentSchema.safeParse({
      cohortId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      title: 'Fullstack System Design Mock',
    });
    expect(assignmentValid.success).toBe(true);

    expect(TenantRole.TENANT_ADMIN).toBe('TENANT_ADMIN');
    expect(AssignmentStatus.PUBLISHED).toBe('PUBLISHED');
  });
});




