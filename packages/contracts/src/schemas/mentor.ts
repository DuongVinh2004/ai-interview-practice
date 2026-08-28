import { z } from 'zod';
import { LiveSessionStatus, CompetencyArea, MentorAuthorityState } from '../enums';

export const MentorAvailabilitySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6), // 0=Sun, 6=Sat
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm'),
  isActive: z.boolean().default(true),
});

export type MentorAvailabilitySlotDto = z.infer<typeof MentorAvailabilitySlotSchema>;

export const MentorProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fullName: z.string(),
  expertiseAreas: z.array(z.string()),
  rating: z.number().min(0).max(5),
  totalSessions: z.number().int().min(0),
  bio: z.string().nullable().optional(),
  isActive: z.boolean().default(false),
  authorityState: z.nativeEnum(MentorAuthorityState).default(MentorAuthorityState.PENDING),
  approvedAt: z.string().or(z.date()).nullable().optional(),
  availabilities: z.array(MentorAvailabilitySlotSchema).optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type MentorProfileDto = z.infer<typeof MentorProfileSchema>;

export const CreateMentorProfileSchema = z.object({
  expertiseAreas: z.array(z.string()).min(1, 'Select at least one expertise area'),
  bio: z.string().max(1000).optional(),
  availabilities: z.array(MentorAvailabilitySlotSchema).optional(),
});

export type CreateMentorProfileDto = z.infer<typeof CreateMentorProfileSchema>;

export const SetAvailabilitySchema = z.object({
  slots: z.array(MentorAvailabilitySlotSchema),
});

export type SetAvailabilityDto = z.infer<typeof SetAvailabilitySchema>;

export const BookSessionSchema = z.object({
  mentorId: z.string().uuid(),
  scheduledAt: z.string().or(z.date()),
  interviewId: z.string().uuid().optional(),
});

export type BookSessionDto = z.infer<typeof BookSessionSchema>;

export const LiveSessionSchema = z.object({
  id: z.string().uuid(),
  mentorId: z.string().uuid(),
  mentorName: z.string().optional(),
  candidateId: z.string().uuid(),
  interviewId: z.string().uuid().nullable().optional(),
  candidateName: z.string().optional(),
  scheduledAt: z.string().or(z.date()),
  status: z.nativeEnum(LiveSessionStatus),
  roomToken: z.string().nullable().optional(),
  transcriptUrl: z.string().nullable().optional(),
  aiNotesJson: z.any().nullable().optional(),
  mentorNotes: z.string().nullable().optional(),
  candidateRating: z.number().min(1).max(5).nullable().optional(),
  startedAt: z.string().or(z.date()).nullable().optional(),
  endedAt: z.string().or(z.date()).nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type LiveSessionDto = z.infer<typeof LiveSessionSchema>;

export const JoinRoomResponseSchema = z.object({
  sessionId: z.string().uuid(),
  roomToken: z.string(),
  roomName: z.string(),
  role: z.enum(['MENTOR', 'CANDIDATE']),
  participantName: z.string(),
  status: z.nativeEnum(LiveSessionStatus),
});

export type JoinRoomResponseDto = z.infer<typeof JoinRoomResponseSchema>;

export const MentorNotesSchema = z.object({
  notes: z.string().max(5000),
});

export type MentorNotesDto = z.infer<typeof MentorNotesSchema>;

export const ScoreOverrideSchema = z.object({
  evaluationId: z.string().uuid(),
  originalScore: z.number().min(0).max(10),
  newScore: z.number().min(0).max(10),
  justification: z.string().min(10, 'Justification must be at least 10 characters').max(2000),
});

export type ScoreOverrideDto = z.infer<typeof ScoreOverrideSchema>;

export const CandidateRatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(1000).optional(),
});

export type CandidateRatingDto = z.infer<typeof CandidateRatingSchema>;

export const CopilotHintSchema = z.object({
  id: z.string(),
  competencyArea: z.nativeEnum(CompetencyArea).or(z.string()),
  topic: z.string(),
  questionText: z.string(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  intentDescription: z.string(),
  expectedKeySignals: z.array(z.string()),
});

export type CopilotHintDto = z.infer<typeof CopilotHintSchema>;

export const CopilotHintsResponseSchema = z.object({
  sessionId: z.string(),
  currentTurnTopic: z.string().optional(),
  hints: z.array(CopilotHintSchema),
});

export type CopilotHintsResponseDto = z.infer<typeof CopilotHintsResponseSchema>;
