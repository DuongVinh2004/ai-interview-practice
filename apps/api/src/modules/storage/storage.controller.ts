import { Controller, Post, Get, Delete, Body, Param, Req, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  PresignUploadDto,
  PresignUploadResponseDto,
  PresignDownloadResponseDto,
  ConfirmUploadDto,
  FileAssetDto,
} from '@ai-interview/contracts';

@ApiTags('Cloud Storage (S3 / R2)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('presign-upload')
  @ApiOperation({ summary: 'Generate a presigned URL for direct cloud upload' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Presigned upload URL generated' })
  async presignUpload(
    @Req() req: any,
    @Body() dto: PresignUploadDto,
  ): Promise<PresignUploadResponseDto> {
    return this.storageService.createUploadIntent(req.user.id, dto);
  }

  @Get('presign-download/:key(*)')
  @ApiOperation({ summary: 'Generate a presigned download URL for private cloud files' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Presigned download URL generated' })
  async presignDownload(
    @Req() req: any,
    @Param('key') key: string,
  ): Promise<PresignDownloadResponseDto> {
    return this.storageService.createDownloadIntent(req.user.id, key, req.user.role);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm file upload and persist asset metadata' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'File asset confirmed and stored' })
  async confirmUpload(@Req() req: any, @Body() dto: ConfirmUploadDto): Promise<FileAssetDto> {
    return this.storageService.confirmUpload(req.user.id, dto);
  }

  @Delete(':key(*)')
  @ApiOperation({ summary: 'Delete a file from cloud storage and database' })
  @ApiResponse({ status: HttpStatus.OK, description: 'File deleted successfully' })
  async deleteFile(@Req() req: any, @Param('key') key: string): Promise<{ success: boolean }> {
    await this.storageService.deleteFile(req.user.id, key, req.user.role);
    return { success: true };
  }
}
