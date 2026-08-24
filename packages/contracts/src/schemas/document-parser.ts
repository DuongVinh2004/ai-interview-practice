import { z } from 'zod';

export const ParsedProjectSchema = z.object({
  name: z.string(),
  role: z.string().optional(),
  technologies: z.array(z.string()).default([]),
  description: z.string().optional(),
  highlights: z.array(z.string()).default([]),
});
export type ParsedProject = z.infer<typeof ParsedProjectSchema>;

export const ParsedExperienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  duration: z.string().optional(),
  responsibilities: z.array(z.string()).default([]),
  projects: z.array(ParsedProjectSchema).default([]),
});
export type ParsedExperience = z.infer<typeof ParsedExperienceSchema>;

export const ParsedProfileDtoSchema = z.object({
  id: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
  fullName: z.string().nullable().optional(),
  targetRole: z.string().nullable().optional(),
  seniorityLevel: z.string().nullable().optional(),
  skills: z.array(z.string()).default([]),
  experience: z.array(ParsedExperienceSchema).default([]),
  education: z.array(z.string()).default([]),
  rawSummary: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()).optional(),
});
export type ParsedProfileDto = z.infer<typeof ParsedProfileDtoSchema>;

export const JdAnalysisDtoSchema = z.object({
  id: z.string().uuid().optional(),
  roleTitle: z.string().nullable().optional(),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  seniorityLevel: z.string().nullable().optional(),
  companyContext: z.string().nullable().optional(),
  rawJdText: z.string().optional(),
  createdAt: z.string().or(z.date()).optional(),
});
export type JdAnalysisDto = z.infer<typeof JdAnalysisDtoSchema>;

export const BlueprintTopicSchema = z.object({
  topic: z.string(),
  weight: z.number().min(0).max(100),
  reason: z.string(),
  sampleQuestions: z.array(z.string()).default([]),
  cvReference: z.string().optional(),
});
export type BlueprintTopic = z.infer<typeof BlueprintTopicSchema>;

export const InterviewBlueprintDtoSchema = z.object({
  id: z.string().uuid().optional(),
  parsedProfileId: z.string().uuid(),
  jdAnalysisId: z.string().uuid(),
  interviewId: z.string().uuid().nullable().optional(),
  matchedSkills: z.array(z.string()).default([]),
  gapSkills: z.array(z.string()).default([]),
  matchPercentage: z.number().min(0).max(100),
  topics: z.array(BlueprintTopicSchema),
  recommendations: z.array(z.string()).default([]),
  targetRole: z.string(),
  targetLevel: z.string(),
  createdAt: z.string().or(z.date()).optional(),
});
export type InterviewBlueprintDto = z.infer<typeof InterviewBlueprintDtoSchema>;

export const ParseCvRequestSchema = z.object({
  fileName: z.string(),
  fileType: z.enum(['pdf', 'docx', 'text']),
  rawText: z.string().min(10, 'Resume text must contain at least 10 characters'),
});
export type ParseCvRequest = z.infer<typeof ParseCvRequestSchema>;

export const AnalyzeJdRequestSchema = z.object({
  jdText: z.string().min(20, 'Job description must contain at least 20 characters'),
  roleTitle: z.string().optional(),
});
export type AnalyzeJdRequest = z.infer<typeof AnalyzeJdRequestSchema>;

export const GenerateBlueprintRequestSchema = z.object({
  parsedProfileId: z.string().uuid(),
  jdAnalysisId: z.string().uuid(),
  targetRole: z.string().optional(),
  targetLevel: z.string().optional(),
});
export type GenerateBlueprintRequest = z.infer<typeof GenerateBlueprintRequestSchema>;

export const TailoredInterviewSetupResponseSchema = z.object({
  parsedProfile: ParsedProfileDtoSchema,
  jdAnalysis: JdAnalysisDtoSchema,
  blueprint: InterviewBlueprintDtoSchema,
});
export type TailoredInterviewSetupResponse = z.infer<typeof TailoredInterviewSetupResponseSchema>;
