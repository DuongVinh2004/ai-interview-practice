import { z } from 'zod';

export const CanvasComponentType = z.enum([
  'LOAD_BALANCER',
  'API_GATEWAY',
  'CDN',
  'MESSAGE_QUEUE',
  'CACHE',
  'RELATIONAL_DB',
  'NOSQL_DB',
  'MICROSERVICE',
  'BLOB_STORAGE',
  'CLIENT',
]);

export type CanvasComponentType = z.infer<typeof CanvasComponentType>;

export const CanvasSnapshotSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  imageUrl: z.string(),
  canvasStateJson: z.any().optional().nullable(),
  elapsedSeconds: z.number().int().min(0),
  aiAnalysis: z.any().optional().nullable(),
  createdAt: z.string().or(z.date()),
});

export type CanvasSnapshotDto = z.infer<typeof CanvasSnapshotSchema>;

export const DesignEvaluationSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  requirementsScore: z.number().min(0).max(10).optional().nullable(),
  highLevelScore: z.number().min(0).max(10).optional().nullable(),
  componentDetailScore: z.number().min(0).max(10).optional().nullable(),
  scalabilityScore: z.number().min(0).max(10).optional().nullable(),
  dataModelScore: z.number().min(0).max(10).optional().nullable(),
  overallScore: z.number().min(0).max(10),
  feedback: z.string().optional().nullable(),
  rubricBreakdown: z
    .object({
      requirements: z.string(),
      highLevel: z.string(),
      componentDetail: z.string(),
      scalability: z.string(),
      dataModel: z.string(),
    })
    .optional(),
  detectedComponents: z.array(z.string()).optional(),
  strengths: z.array(z.string()).optional(),
  bottlenecks: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  createdAt: z.string().or(z.date()),
});

export type DesignEvaluationDto = z.infer<typeof DesignEvaluationSchema>;

export const SystemDesignSessionSchema = z.object({
  id: z.string().uuid(),
  interviewId: z.string().uuid(),
  initialPrompt: z.string().optional().nullable(),
  finalCanvasUrl: z.string().optional().nullable(),
  snapshots: z.array(CanvasSnapshotSchema).optional(),
  evaluation: DesignEvaluationSchema.optional().nullable(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type SystemDesignSessionDto = z.infer<typeof SystemDesignSessionSchema>;

export const InitCanvasSessionSchema = z.object({
  initialPrompt: z.string().optional(),
});

export type InitCanvasSessionDto = z.infer<typeof InitCanvasSessionSchema>;

export const UploadCanvasSnapshotSchema = z.object({
  imageUrl: z.string().min(1),
  canvasStateJson: z.any().optional(),
  elapsedSeconds: z.number().int().min(0).default(0),
});

export type UploadCanvasSnapshotDto = z.infer<typeof UploadCanvasSnapshotSchema>;

export const VisionAnalysisResultSchema = z.object({
  snapshotId: z.string().optional(),
  summary: z.string(),
  detectedComponents: z.array(z.string()),
  architectureStyle: z.string(),
  strengths: z.array(z.string()),
  potentialBottlenecks: z.array(z.string()),
  realtimeSuggestions: z.array(z.string()),
  rubricScores: z.object({
    requirements: z.number().min(0).max(10),
    highLevel: z.number().min(0).max(10),
    componentDetail: z.number().min(0).max(10),
    scalability: z.number().min(0).max(10),
    dataModel: z.number().min(0).max(10),
  }),
});

export type VisionAnalysisResultDto = z.infer<typeof VisionAnalysisResultSchema>;
