import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsEnum, IsNumber, Min, Max, IsBoolean } from 'class-validator';
import { AudioVoice, AudioProvider, InterviewMode } from '@ai-interview/contracts';

export class SynthesizeSpeechRequestDto {
  @ApiProperty({
    description: 'Text to synthesize into speech',
    example: 'Can you describe how database indexing works with B-Trees?',
    maxLength: 4096,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  text!: string;

  @ApiPropertyOptional({
    description: 'Voice persona to use for synthesis',
    enum: AudioVoice,
    default: AudioVoice.ALLOY,
  })
  @IsOptional()
  @IsEnum(AudioVoice)
  voice?: AudioVoice;

  @ApiPropertyOptional({
    description: 'Playback speed multiplier (0.5 to 2.0)',
    default: 1.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  speed?: number;

  @ApiPropertyOptional({
    description: 'Preferred audio provider',
    enum: AudioProvider,
  })
  @IsOptional()
  @IsEnum(AudioProvider)
  provider?: AudioProvider;
}

export class TranscribeAudioResponseDto {
  @ApiProperty({ description: 'Transcribed text from the audio' })
  text!: string;

  @ApiProperty({ description: 'Transcription confidence score (0-1)' })
  confidence!: number;

  @ApiPropertyOptional({ description: 'Audio duration in seconds' })
  durationSeconds?: number;

  @ApiPropertyOptional({ description: 'Detected language code (e.g. en, vi)' })
  detectedLanguage?: string;

  @ApiProperty({ description: 'Provider used for STT' })
  provider!: string;
}

export class SynthesizeSpeechResponseDto {
  @ApiProperty({ description: 'Base64 encoded audio stream' })
  audioBase64!: string;

  @ApiProperty({ description: 'MIME type of the audio (e.g. audio/mpeg, audio/wav)' })
  mimeType!: string;

  @ApiPropertyOptional({ description: 'Estimated audio duration in seconds' })
  durationSeconds?: number;

  @ApiProperty({ description: 'Provider used for TTS synthesis' })
  provider!: string;
}

export class AudioSettingsDto {
  @ApiPropertyOptional({ enum: InterviewMode, default: InterviewMode.TEXT })
  @IsOptional()
  @IsEnum(InterviewMode)
  mode?: InterviewMode;

  @ApiPropertyOptional({ enum: AudioVoice, default: AudioVoice.ALLOY })
  @IsOptional()
  @IsEnum(AudioVoice)
  voice?: AudioVoice;

  @ApiPropertyOptional({ default: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  playbackSpeed?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  autoPlayTts?: boolean;

  @ApiPropertyOptional({ default: 80 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  micSensitivity?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  pushToTalk?: boolean;
}
