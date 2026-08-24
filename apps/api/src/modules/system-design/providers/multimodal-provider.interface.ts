import { VisionAnalysisResultDto } from '@ai-interview/contracts';

export interface MultimodalAnalysisOptions {
  imageUrl: string;
  canvasStateJson?: any;
  problemPrompt?: string;
  previousAnalysis?: any;
}

export interface MultimodalProvider {
  analyzeCanvasDiagram(options: MultimodalAnalysisOptions): Promise<VisionAnalysisResultDto>;
}
