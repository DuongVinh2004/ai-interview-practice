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

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentParserController {
  constructor(private readonly parserService: DocumentParserService) {}

  @Post('parse-cv')
  @UseInterceptors(FileInterceptor('file'))
  async parseCv(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: any,
  ) {
    if (file) {
      const fileName = file.originalname || 'resume.pdf';
      const fileType = fileName.endsWith('.pdf') ? 'pdf' : fileName.endsWith('.docx') ? 'docx' : 'text';
      return this.parserService.parseCv(userId, { fileName, fileType, rawText: '' }, file.buffer);
    }

    const parsed = ParseCvRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors[0]?.message || 'Invalid CV parse payload');
    }
    return this.parserService.parseCv(userId, parsed.data);
  }

  @Post('analyze-jd')
  async analyzeJd(
    @CurrentUser('sub') userId: string,
    @Body() body: any,
  ) {
    const parsed = AnalyzeJdRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors[0]?.message || 'Invalid JD analysis payload');
    }
    return this.parserService.analyzeJd(userId, parsed.data);
  }

  @Post('generate-blueprint')
  async generateBlueprint(
    @CurrentUser('sub') userId: string,
    @Body() body: any,
  ) {
    const parsed = GenerateBlueprintRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors[0]?.message || 'Invalid blueprint request payload');
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
  async getBlueprint(@Param('id') id: string) {
    return this.parserService.getBlueprint(id);
  }

  @Delete(':id')
  async deleteDocument(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.parserService.deleteDocument(userId, id);
  }
}
