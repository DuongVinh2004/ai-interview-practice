import { z } from 'zod';

export const ComponentTypeSchema = z.enum([
  'CLIENT',
  'LOAD_BALANCER',
  'API_GATEWAY',
  'MICROSERVICE',
  'DATABASE_SQL',
  'DATABASE_NOSQL',
  'CACHE_REDIS',
  'MESSAGE_QUEUE_KAFKA',
  'OBJECT_STORAGE_S3',
  'CDN',
  'SEARCH_ELASTIC',
]);

export type ComponentType = z.infer<typeof ComponentTypeSchema>;

export const CanvasElementSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().default(140),
  height: z.number().default(60),
  color: z.string().default('#4f46e5'),
  properties: z.record(z.any()).optional(),
});

export type CanvasElementDto = z.infer<typeof CanvasElementSchema>;

export const CanvasConnectorSchema = z.object({
  id: z.string(),
  fromId: z.string(),
  toId: z.string(),
  protocol: z.string().default('HTTP/REST'),
  label: z.string().optional(),
});

export type CanvasConnectorDto = z.infer<typeof CanvasConnectorSchema>;

export const CanvasStateSchema = z.object({
  elements: z.array(CanvasElementSchema).default([]),
  connectors: z.array(CanvasConnectorSchema).default([]),
  zoom: z.number().default(1),
  panX: z.number().default(0),
  panY: z.number().default(0),
});

export type CanvasStateDto = z.infer<typeof CanvasStateSchema>;

export const CanvasSnapshotDtoSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  imageUrl: z.string(),
  canvasStateJson: CanvasStateSchema.optional(),
  elapsedSeconds: z.number().default(0),
  createdAt: z.string(),
});

export type CanvasSnapshotDto = z.infer<typeof CanvasSnapshotDtoSchema>;

export const SystemDesignSessionDtoSchema = z.object({
  id: z.string(),
  interviewId: z.string(),
  initialPrompt: z.string().nullable(),
  finalCanvasUrl: z.string().nullable(),
  snapshots: z.array(CanvasSnapshotDtoSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SystemDesignSessionDto = z.infer<typeof SystemDesignSessionDtoSchema>;

export const VisionAnalysisResultSchema = z.object({
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
  annotations: z.array(z.any()).optional(),
});

export type VisionAnalysisResultDto = z.infer<typeof VisionAnalysisResultSchema>;

export const VisualAnnotationSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  comment: z.string().optional(),
  label: z.string().optional(),
  suggestion: z.string().optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical', 'good', 'suggestion']).default('info'),
  componentName: z.string().optional(),
});
export type VisualAnnotationDto = z.infer<typeof VisualAnnotationSchema>;

export const EvaluateDiagramSchema = z.object({
  imageUrl: z.string().min(1),
  canvasStateJson: z.any().optional(),
  canvasData: z.any().optional(),
  promptContext: z.string().optional(),
  fileAssetId: z.string().optional(),
  language: z.enum(['vi', 'en']).optional(),
});
export type EvaluateDiagramDto = z.infer<typeof EvaluateDiagramSchema>;

export const DesignEvaluationResultSchema = z.object({
  id: z.string().optional(),
  sessionId: z.string().optional(),
  scores: z
    .object({
      requirements: z.number().min(0).max(10),
      highLevelArchitecture: z.number().min(0).max(10),
      componentDetail: z.number().min(0).max(10),
      scalability: z.number().min(0).max(10),
      dataModel: z.number().min(0).max(10),
    })
    .optional(),
  requirementsScore: z.number().optional(),
  highLevelScore: z.number().optional(),
  componentDetailScore: z.number().optional(),
  scalabilityScore: z.number().optional(),
  dataModelScore: z.number().optional(),
  overallScore: z.number().min(0).max(10),
  summary: z.string().optional(),
  feedback: z.string(),
  annotations: z.array(VisualAnnotationSchema).default([]),
  detectedComponents: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  bottlenecks: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  createdAt: z.string().optional(),
});
export type DesignEvaluationResultDto = z.infer<typeof DesignEvaluationResultSchema>;

export const DesignEvaluationDtoSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  requirementsScore: z.number(),
  highLevelScore: z.number(),
  componentDetailScore: z.number(),
  scalabilityScore: z.number(),
  dataModelScore: z.number(),
  overallScore: z.number(),
  feedback: z.string(),
  rubricBreakdown: z.record(z.string()).optional(),
  detectedComponents: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  bottlenecks: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  createdAt: z.string(),
});

export type DesignEvaluationDto = z.infer<typeof DesignEvaluationDtoSchema>;
