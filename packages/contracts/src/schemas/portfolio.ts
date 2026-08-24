import { z } from 'zod';
import { CompetencyArea, BadgeLevel, CertificateStatus } from '../enums';

export const PublicPortfolioSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  username: z.string().min(3).max(30),
  isPublic: z.boolean().default(false),
  displayName: z.string().max(100).nullable().optional(),
  showRealName: z.boolean().default(true),
  showBio: z.boolean().default(true),
  showSkills: z.boolean().default(true),
  showBadges: z.boolean().default(true),
  showCertificates: z.boolean().default(true),
  showHistory: z.boolean().default(false),
  customBio: z.string().nullable().optional(),
  ogImageUrl: z.string().nullable().optional(),
  viewCount: z.number().int().default(0),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type PublicPortfolioDto = z.infer<typeof PublicPortfolioSchema>;

export const UpdatePortfolioSettingsSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username must be alphanumeric with underscores or dashes')
    .optional(),
  isPublic: z.boolean().optional(),
  displayName: z.string().max(100).optional(),
  showRealName: z.boolean().optional(),
  showBio: z.boolean().optional(),
  showSkills: z.boolean().optional(),
  showBadges: z.boolean().optional(),
  showCertificates: z.boolean().optional(),
  showHistory: z.boolean().optional(),
  customBio: z.string().max(1000).optional(),
});

export type UpdatePortfolioSettingsDto = z.infer<typeof UpdatePortfolioSettingsSchema>;

export const UserBadgeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  competencyArea: z.nativeEnum(CompetencyArea),
  level: z.nativeEnum(BadgeLevel),
  score: z.number().min(0).max(10),
  evidenceCount: z.number().int().min(0),
  earnedAt: z.string().or(z.date()),
});

export type UserBadgeDto = z.infer<typeof UserBadgeSchema>;

export const BadgeProgressItemSchema = z.object({
  competencyArea: z.nativeEnum(CompetencyArea),
  areaName: z.string(),
  highestLevel: z.nativeEnum(BadgeLevel).nullable(),
  currentScore: z.number(),
  evidenceCount: z.number(),
  nextBadgeLevel: z.nativeEnum(BadgeLevel).nullable(),
  requiredScore: z.number().nullable(),
  requiredEvidence: z.number().nullable(),
  progressPercentage: z.number(),
  isUnlocked: z.boolean(),
  earnedAt: z.string().nullable().optional(),
});

export type BadgeProgressItemDto = z.infer<typeof BadgeProgressItemSchema>;

export const CertificateSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  competencyArea: z.nativeEnum(CompetencyArea).nullable().optional(),
  type: z.string().max(20),
  score: z.number(),
  tierSlug: z.string().nullable().optional(),
  status: z.nativeEnum(CertificateStatus),
  signatureHash: z.string().max(128),
  fileUrl: z.string().nullable().optional(),
  qrCodeUrl: z.string().nullable().optional(),
  issuedAt: z.string().or(z.date()).nullable().optional(),
  expiresAt: z.string().or(z.date()).nullable().optional(),
  revokedAt: z.string().or(z.date()).nullable().optional(),
  revokeReason: z.string().nullable().optional(),
  downloadCount: z.number().int().default(0),
  verifyCount: z.number().int().default(0),
  createdAt: z.string().or(z.date()),
});

export type CertificateDto = z.infer<typeof CertificateSchema>;

export const GenerateCertificateSchema = z.object({
  competencyArea: z.nativeEnum(CompetencyArea).optional(),
  type: z.enum(['COMPETENCY', 'OVERALL', 'TIER']).default('COMPETENCY'),
});

export type GenerateCertificateDto = z.infer<typeof GenerateCertificateSchema>;

export const VerifyCertificateResponseSchema = z.object({
  isValid: z.boolean(),
  status: z.nativeEnum(CertificateStatus),
  certId: z.string(),
  recipientName: z.string(),
  competencyArea: z.nativeEnum(CompetencyArea).nullable().optional(),
  score: z.number(),
  tierSlug: z.string().nullable().optional(),
  signatureHash: z.string(),
  issuedAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  verifyCount: z.number(),
  message: z.string(),
});

export type VerifyCertificateResponseDto = z.infer<typeof VerifyCertificateResponseSchema>;

export const PublicPortfolioProfileViewSchema = z.object({
  username: z.string(),
  displayName: z.string().nullable(),
  realName: z.string().nullable(),
  bio: z.string().nullable(),
  viewCount: z.number(),
  memberSince: z.string(),
  skills: z
    .array(
      z.object({
        area: z.nativeEnum(CompetencyArea),
        name: z.string(),
        score: z.number(),
        evidenceCount: z.number(),
      }),
    )
    .optional(),
  badges: z.array(UserBadgeSchema).optional(),
  certificates: z.array(CertificateSchema).optional(),
  historyHighlights: z
    .array(
      z.object({
        sessionId: z.string(),
        roleName: z.string(),
        score: z.number(),
        completedAt: z.string(),
      }),
    )
    .optional(),
  readinessSummary: z
    .object({
      readinessScore: z.number(),
      tierName: z.string(),
    })
    .nullable()
    .optional(),
});

export type PublicPortfolioProfileViewDto = z.infer<typeof PublicPortfolioProfileViewSchema>;
