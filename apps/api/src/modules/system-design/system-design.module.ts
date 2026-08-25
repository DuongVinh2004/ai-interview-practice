import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SystemDesignController } from './system-design.controller';
import { CanvasService } from './services/canvas.service';
import { DesignAnalyzerService } from './services/design-analyzer.service';
import { DesignEvaluationService } from './services/design-evaluation.service';
import { MockVisionProvider } from './providers/mock-vision.provider';
import { OpenAiVisionProvider } from './providers/openai-vision.provider';
import { GeminiVisionProvider } from './providers/gemini-vision.provider';

@Module({
  imports: [ConfigModule],
  controllers: [SystemDesignController],
  providers: [
    CanvasService,
    DesignAnalyzerService,
    DesignEvaluationService,
    MockVisionProvider,
    OpenAiVisionProvider,
    GeminiVisionProvider,
    {
      provide: 'VISION_PROVIDER',
      useFactory: (
        configService: ConfigService,
        geminiProvider: GeminiVisionProvider,
        openAiProvider: OpenAiVisionProvider,
        mockProvider: MockVisionProvider,
      ) => {
        const providerName =
          configService.get<string>('vision.provider') ||
          process.env.VISION_PROVIDER ||
          'mock';

        if (providerName === 'gemini') {
          const geminiKey =
            configService.get<string>('vision.geminiApiKey') ||
            configService.get<string>('ai.geminiApiKey') ||
            process.env.GEMINI_API_KEY;
          if (geminiKey && !geminiKey.includes('mock')) {
            return geminiProvider;
          }
        }

        if (providerName === 'openai') {
          const openAiKey =
            configService.get<string>('vision.openaiApiKey') ||
            configService.get<string>('ai.openaiApiKey') ||
            process.env.OPENAI_API_KEY;
          if (openAiKey && !openAiKey.includes('mock')) {
            return openAiProvider;
          }
        }

        return mockProvider;
      },
      inject: [ConfigService, GeminiVisionProvider, OpenAiVisionProvider, MockVisionProvider],
    },
  ],
  exports: [
    CanvasService,
    DesignAnalyzerService,
    DesignEvaluationService,
    MockVisionProvider,
    'VISION_PROVIDER',
  ],
})
export class SystemDesignModule {}
