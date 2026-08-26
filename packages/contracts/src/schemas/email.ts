import { z } from 'zod';

export const EmailTemplateTypeSchema = z.enum([
  'welcome',
  'interview_completion',
  'streak_warning',
  'payment_receipt',
]);
export type EmailTemplateType = z.infer<typeof EmailTemplateTypeSchema>;

export const SendEmailSchema = z.object({
  to: z.string().email().or(z.array(z.string().email())),
  template: EmailTemplateTypeSchema,
  data: z.record(z.any()),
  subject: z.string().optional(),
});
export type SendEmailDto = z.infer<typeof SendEmailSchema>;

export const EmailSendResultSchema = z.object({
  id: z.string(),
  provider: z.string(),
  success: z.boolean(),
});
export type EmailSendResultDto = z.infer<typeof EmailSendResultSchema>;
