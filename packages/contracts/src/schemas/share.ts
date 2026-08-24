import { z } from 'zod';
import { ShareExpiryDuration } from '../enums';

export const CreateShareTokenDtoSchema = z.object({
  expiry: z.nativeEnum(ShareExpiryDuration).default(ShareExpiryDuration.SEVEN_DAYS),
  isAnonymized: z.boolean().default(false),
  passcode: z.string().min(4).max(30).optional(),
});

export type CreateShareTokenDto = z.infer<typeof CreateShareTokenDtoSchema>;

export const AddMentorFeedbackDtoSchema = z.object({
  turnNumber: z.number().int().min(1).max(5).optional(),
  mentorName: z.string().trim().min(2, 'Mentor name must have at least 2 characters').max(100),
  comment: z.string().trim().min(5, 'Comment must have at least 5 characters').max(2000),
});

export type AddMentorFeedbackDto = z.infer<typeof AddMentorFeedbackDtoSchema>;

export const MentorFeedbackDtoSchema = z.object({
  id: z.string().uuid(),
  turnNumber: z.number().nullable().optional(),
  mentorName: z.string(),
  comment: z.string(),
  createdAt: z.string(),
});

export type MentorFeedbackDto = z.infer<typeof MentorFeedbackDtoSchema>;

export const ShareTokenDtoSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  token: z.string(),
  shareUrl: z.string(),
  isRevoked: z.boolean(),
  isAnonymized: z.boolean(),
  expiresAt: z.string().nullable(),
  viewCount: z.number(),
  lastViewedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  mentorFeedback: z.array(MentorFeedbackDtoSchema).default([]),
});

export type ShareTokenDto = z.infer<typeof ShareTokenDtoSchema>;
