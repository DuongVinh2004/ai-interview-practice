import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AudioOrchestratorService } from './audio-orchestrator.service';
import {
  SynthesizeSpeechRequestDto,
  SynthesizeSpeechResponseDto,
  TranscribeAudioResponseDto,
} from './dto/audio.dto';
import { ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../platform/filters/all-exceptions.filter';

const ALLOWED_AUDIO_MIMES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/m4a',
  'audio/mp4',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/flac',
  'audio/aac',
]);

@ApiTags('Audio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audio')
export class AudioController {
  constructor(private readonly audioOrchestratorService: AudioOrchestratorService) {}

  @Post('transcribe')
  @ApiOperation({ summary: 'Transcribe audio recording to text via Whisper STT' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Audio file to transcribe (webm, wav, mp3, m4a, ogg, max 25MB)',
        },
      },
    },
  })
  @ApiQuery({ name: 'language', required: false, description: 'Language code (e.g. en, vi)' })
  @ApiQuery({ name: 'sessionId', required: false, description: 'Interview session ID' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
    }),
  )
  async transcribeAudio(
    @UploadedFile() file?: Express.Multer.File,
    @Query('language') language?: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<TranscribeAudioResponseDto> {
    if (!file) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'No audio file uploaded. Please provide an audio file in the "file" field.',
        400,
      );
    }

    const cleanMime = file.mimetype.split(';')[0].trim().toLowerCase();
    if (!ALLOWED_AUDIO_MIMES.has(file.mimetype.toLowerCase()) && !ALLOWED_AUDIO_MIMES.has(cleanMime)) {
      throw new DomainException(
        ErrorCode.AUDIO_UNSUPPORTED_FORMAT,
        `Unsupported audio format: ${file.mimetype}. Supported formats: webm, wav, mp3, m4a, ogg, mp4.`,
        400,
      );
    }

    const result = await this.audioOrchestratorService.transcribeAudio(
      file.buffer,
      file.mimetype,
      file.originalname || 'audio.webm',
      language,
      sessionId,
    );

    return {
      text: result.text,
      confidence: result.confidence,
      durationSeconds: result.durationSeconds,
      detectedLanguage: result.detectedLanguage,
      provider: result.provider,
    };
  }

  @Post('synthesize')
  @ApiOperation({ summary: 'Synthesize text into speech audio base64 stream via OpenAI TTS' })
  async synthesizeSpeech(
    @Body() dto: SynthesizeSpeechRequestDto,
    @Query('sessionId') sessionId?: string,
  ): Promise<SynthesizeSpeechResponseDto> {
    const result = await this.audioOrchestratorService.synthesizeSpeech(
      dto.text,
      dto.voice,
      dto.speed,
      sessionId,
    );

    return {
      audioBase64: result.audioBuffer.toString('base64'),
      mimeType: result.mimeType,
      durationSeconds: result.durationSeconds,
      provider: result.provider,
    };
  }
}
