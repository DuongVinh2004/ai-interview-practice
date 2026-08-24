import { z } from 'zod';
import { CompetencyArea, UserRole, UserStatus } from '../enums';
import { InterviewSessionDtoSchema } from './interview';

export const UpdateProfileDtoSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(100).optional(),
  targetRole: z.string().trim().max(100).optional(),
  targetLevel: z.string().trim().max(50).optional(),
  bio: z.string().trim().max(1000).optional(),
});

export type UpdateProfileDto = z.infer<typeof UpdateProfileDtoSchema>;

export const UserProfileDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fullName: z.string(),
  targetRole: z.string().nullable().optional(),
  targetLevel: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  user: z
    .object({
      id: z.string().uuid(),
      email: z.string().email(),
      role: z.nativeEnum(UserRole),
      status: z.nativeEnum(UserStatus),
      createdAt: z.string(),
    })
    .optional(),
});

export type UserProfileDto = z.infer<typeof UserProfileDtoSchema>;

export const CompetencyBenchmarkItemSchema = z.object({
  competency: z.nativeEnum(CompetencyArea),
  name: z.string(),
  userScore: z.number().min(0).max(10),
  benchmarkScore: z.number().min(0).max(10),
  gap: z.number(), // userScore - benchmarkScore
  status: z.enum(['EXCEEDS', 'MEETS', 'GROWTH_REQUIRED']),
  recommendation: z.string(),
});

export type CompetencyBenchmarkItem = z.infer<typeof CompetencyBenchmarkItemSchema>;

export const CompetencyBenchmarkResponseSchema = z.object({
  userId: z.string().uuid(),
  targetLevel: z.string(),
  evaluatedTurnsCount: z.number().int().min(0),
  overallReadinessScore: z.number().min(0).max(10),
  readinessPercentage: z.number().min(0).max(100),
  benchmarks: z.array(CompetencyBenchmarkItemSchema),
  topStrengths: z.array(z.string()),
  priorityGaps: z.array(z.string()),
  summary: z.string(),
});

export type CompetencyBenchmarkResponse = z.infer<typeof CompetencyBenchmarkResponseSchema>;

export const UserDataExportSchema = z.object({
  exportedAt: z.string(),
  gdprComplianceVersion: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: z.nativeEnum(UserRole),
    status: z.nativeEnum(UserStatus),
    createdAt: z.string(),
  }),
  profile: z.object({
    fullName: z.string(),
    targetRole: z.string().nullable().optional(),
    targetLevel: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
  }),
  sessions: z.array(InterviewSessionDtoSchema),
  summary: z.object({
    totalSessionsCount: z.number().int().min(0),
    completedSessionsCount: z.number().int().min(0),
    totalEvaluatedTurns: z.number().int().min(0),
    averageScore: z.number().nullable().optional(),
  }),
});

export type UserDataExport = z.infer<typeof UserDataExportSchema>;
