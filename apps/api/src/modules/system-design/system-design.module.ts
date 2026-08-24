import { Module } from '@nestjs/common';
import { SystemDesignController } from './system-design.controller';
import { CanvasService } from './services/canvas.service';
import { DesignAnalyzerService } from './services/design-analyzer.service';
import { DesignEvaluationService } from './services/design-evaluation.service';
import { MockVisionProvider } from './providers/mock-vision.provider';

@Module({
  controllers: [SystemDesignController],
  providers: [
    CanvasService,
    DesignAnalyzerService,
    DesignEvaluationService,
    MockVisionProvider,
  ],
  exports: [
    CanvasService,
    DesignAnalyzerService,
    DesignEvaluationService,
    MockVisionProvider,
  ],
})
export class SystemDesignModule {}
