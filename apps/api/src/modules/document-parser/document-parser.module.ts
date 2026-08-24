import { Module } from '@nestjs/common';
import { DocumentParserController } from './document-parser.controller';
import { DocumentParserService } from './document-parser.service';
import { TextExtractorService } from './services/text-extractor.service';
import { CvAnalyzerService } from './services/cv-analyzer.service';
import { JdAnalyzerService } from './services/jd-analyzer.service';
import { BlueprintGeneratorService } from './services/blueprint-generator.service';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [PlatformModule],
  controllers: [DocumentParserController],
  providers: [
    DocumentParserService,
    TextExtractorService,
    CvAnalyzerService,
    JdAnalyzerService,
    BlueprintGeneratorService,
  ],
  exports: [
    DocumentParserService,
    TextExtractorService,
    CvAnalyzerService,
    JdAnalyzerService,
    BlueprintGeneratorService,
  ],
})
export class DocumentParserModule {}
