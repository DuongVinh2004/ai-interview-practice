import {
  ParseCvRequestSchema,
  AnalyzeJdRequestSchema,
  GenerateBlueprintRequestSchema,
} from '@ai-interview/contracts';

export type ParseCvDto = typeof ParseCvRequestSchema._type;
export type AnalyzeJdDto = typeof AnalyzeJdRequestSchema._type;
export type GenerateBlueprintDto = typeof GenerateBlueprintRequestSchema._type;
