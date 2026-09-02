import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '@ai-interview/contracts';
import { InterviewConfigurationService } from './interview-configuration.service';
import {
  CreatePresetRequestDto,
  UpdatePresetRequestDto,
  ValidateConfigurationRequestDto,
} from './dto/interview-configuration.dto';

@ApiTags('Interview Configurations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interview-configurations')
export class InterviewConfigurationController {
  constructor(private readonly configService: InterviewConfigurationService) {}

  @Get('presets')
  @ApiOperation({ summary: 'Lấy danh sách cấu hình preset đã lưu của người dùng (ghim lên trước)' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách preset kèm thông tin taxonomy và tính tương thích',
  })
  async listPresets(@CurrentUser() user: JwtPayload) {
    const userId = user.id || user.sub;
    return this.configService.listPresets(userId);
  }

  @Post('presets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo preset cấu hình mới có đặt tên và tùy chọn ghim' })
  @ApiResponse({ status: 201, description: 'Preset đã được tạo thành công' })
  async createPreset(@CurrentUser() user: JwtPayload, @Body() dto: CreatePresetRequestDto) {
    const userId = user.id || user.sub;
    return this.configService.createPreset(userId, dto);
  }

  @Patch('presets/:id')
  @ApiOperation({
    summary: 'Cập nhật preset (đổi tên, mô tả, trạng thái ghim hoặc chi tiết cấu hình)',
  })
  @ApiResponse({ status: 200, description: 'Preset đã được cập nhật' })
  async updatePreset(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePresetRequestDto,
  ) {
    const userId = user.id || user.sub;
    return this.configService.updatePreset(userId, id, dto);
  }

  @Delete('presets/:id')
  @ApiOperation({
    summary: 'Xóa một preset cấu hình (không ảnh hưởng đến các session phỏng vấn cũ)',
  })
  @ApiResponse({ status: 200, description: 'Preset đã được xóa' })
  async deletePreset(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const userId = user.id || user.sub;
    return this.configService.deletePreset(userId, id);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Lấy danh sách cấu hình gần đây nhất của người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách recent configurations kèm useCount và lastUsedAt',
  })
  async listRecent(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    const userId = user.id || user.sub;
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 8, 1), 20) : 8;
    return this.configService.listRecent(userId, parsedLimit);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kiểm tra tính tương thích của cấu hình hoặc preset với taxonomy và gói tài khoản',
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả validation và danh sách cảnh báo/lỗi (nếu có)',
  })
  async validateConfig(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ValidateConfigurationRequestDto,
  ) {
    const userId = user.id || user.sub;
    if (dto.presetId) {
      const presets = await this.configService.listPresets(userId);
      const target = presets.find(p => p.id === dto.presetId);
      if (!target) {
        return {
          isValid: false,
          fingerprint: '',
          issues: [
            { field: 'presetId', code: 'PRESET_NOT_FOUND', message: 'Preset không tồn tại' },
          ],
        };
      }
      return this.configService.validateConfiguration(userId, {
        jobRoleId: target.jobRoleId,
        seniorityLevelId: target.seniorityLevelId,
        technologyIds: target.technologyIds,
        sessionMode: target.sessionMode,
        competencyArea: target.competencyArea || undefined,
        language: target.language,
        totalTurns: target.totalTurns,
        isSandbox: target.isSandbox,
        blueprintId: target.blueprintId || undefined,
      });
    }

    if (dto.config) {
      return this.configService.validateConfiguration(userId, dto.config);
    }

    return {
      isValid: false,
      fingerprint: '',
      issues: [
        {
          field: 'config',
          code: 'MISSING_PAYLOAD',
          message: 'Vui lòng cung cấp presetId hoặc config',
        },
      ],
    };
  }
}
