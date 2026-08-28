import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SetupDraftService } from './setup-draft.service';
import {
  CreateSetupDraftRequestDto,
  UpdateSetupDraftRequestDto,
  AnalyzeProfileToDraftRequestDto,
  ApplyPresetToDraftRequestDto,
  ResolveConflictsRequestDto,
} from './dto/setup-draft.dto';

@ApiTags('Interview Setup Drafts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interview-configurations/setup-drafts')
export class SetupDraftController {
  constructor(private readonly draftService: SetupDraftService) {}

  @Get('active')
  @ApiOperation({
    summary: 'Lấy hoặc khởi tạo draft thiết lập phỏng vấn đang kích hoạt của người dùng',
  })
  @ApiResponse({ status: 200, description: 'Thông tin bản nháp thiết lập phỏng vấn' })
  async getActiveDraft(@Req() req: any) {
    const userId = req.user.id;
    return this.draftService.getOrCreateActiveDraft(userId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tạo hoặc khôi phục draft thiết lập phỏng vấn' })
  @ApiResponse({ status: 200, description: 'Bản nháp thiết lập phỏng vấn' })
  async createOrResumeDraft(@Req() req: any, @Body() dto: CreateSetupDraftRequestDto) {
    const userId = req.user.id;
    return this.draftService.getOrCreateActiveDraft(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết bản nháp thiết lập phỏng vấn theo ID' })
  @ApiResponse({ status: 200, description: 'Chi tiết bản nháp' })
  async getDraft(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const userId = req.user.id;
    return this.draftService.getDraft(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Lưu các chỉnh sửa bản nháp phỏng vấn an toàn (Auto-save)' })
  @ApiResponse({ status: 200, description: 'Bản nháp sau khi cập nhật' })
  async updateDraft(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSetupDraftRequestDto,
  ) {
    const userId = req.user.id;
    return this.draftService.updateDraft(userId, id, dto);
  }

  @Post(':id/analyze-profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gắn hồ sơ CV/JD đã trích xuất vào draft và tự động tạo gợi ý taxonomy',
  })
  @ApiResponse({
    status: 200,
    description: 'Bản nháp đã gắn thông tin ứng viên và đề xuất cấu hình',
  })
  async analyzeProfile(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnalyzeProfileToDraftRequestDto,
  ) {
    const userId = req.user.id;
    return this.draftService.attachExtractedProfile(userId, id, dto);
  }

  @Post(':id/apply-preset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Tạo preview so sánh khác biệt (diff) giữa CV/JD và preset đã chọn (không ghi đè ngay)',
  })
  @ApiResponse({ status: 200, description: 'Bảng diff so sánh các trường và đề xuất merge' })
  async applyPreset(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyPresetToDraftRequestDto,
  ) {
    const userId = req.user.id;
    return this.draftService.previewApplyPreset(userId, id, dto.presetId);
  }

  @Post(':id/resolve-conflicts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lưu lựa chọn của người dùng cho các trường mâu thuẫn giữa CV và Preset',
  })
  @ApiResponse({
    status: 200,
    description: 'Bản nháp đã cập nhật cấu hình theo quyết định của người dùng',
  })
  async resolveConflicts(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveConflictsRequestDto,
  ) {
    const userId = req.user.id;
    return this.draftService.resolveConflictsAndApply(userId, id, dto);
  }
}
