import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DocumentParserService } from './document-parser.service';
import {
  ParseCvRequestSchema,
  AnalyzeJdRequestSchema,
  GenerateBlueprintRequestSchema,
} from '@ai-interview/contracts';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentParserController {
  constructor(private readonly parserService: DocumentParserService) {}

  @Post('parse-cv')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
      },
      fileFilter: (_req, file, callback) => {
        const ext = file.originalname.toLowerCase();
        if (
          !ALLOWED_MIME_TYPES.includes(file.mimetype) &&
          !ext.endsWith('.pdf') &&
          !ext.endsWith('.docx') &&
          !ext.endsWith('.txt')
        ) {
          return callback(
            new BadRequestException(
              'Invalid file type. Only PDF, DOCX, and TXT files are allowed.',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async parseCv(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: any,
  ) {
    if (file) {
      const fileName = file.originalname || 'resume.pdf';
      const normalizedFileName = fileName.toLowerCase();
      const fileType = normalizedFileName.endsWith('.pdf')
        ? 'pdf'
        : normalizedFileName.endsWith('.docx')
          ? 'docx'
          : 'text';
      return this.parserService.parseCv(userId, { fileName, fileType, rawText: '' }, file.buffer);
    }

    const parsed = ParseCvRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors[0]?.message || 'Invalid CV parse payload');
    }
    return this.parserService.parseCv(userId, parsed.data);
  }

  @Post('analyze-jd')
  async analyzeJd(@CurrentUser('sub') userId: string, @Body() body: any) {
    const parsed = AnalyzeJdRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.errors[0]?.message || 'Invalid JD analysis payload',
      );
    }
    return this.parserService.analyzeJd(userId, parsed.data);
  }

  @Post('generate-blueprint')
  async generateBlueprint(@CurrentUser('sub') userId: string, @Body() body: any) {
    const parsed = GenerateBlueprintRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.errors[0]?.message || 'Invalid blueprint request payload',
      );
    }
    return this.parserService.generateBlueprint(userId, parsed.data);
  }

  @Get('my-documents')
  async getMyDocuments(@CurrentUser('sub') userId: string) {
    return this.parserService.getUserDocuments(userId);
  }

  @Get('my-profiles')
  async getMyProfiles(@CurrentUser('sub') userId: string) {
    return this.parserService.getUserProfiles(userId);
  }

  @Get('my-blueprints')
  async getMyBlueprints(@CurrentUser('sub') userId: string) {
    return this.parserService.getUserBlueprints(userId);
  }

  @Get('blueprints/:id')
  async getBlueprint(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.parserService.getBlueprint(userId, id);
  }

  @Delete(':id')
  async deleteDocument(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.parserService.deleteDocument(userId, id);
  }
}
