import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { PortfolioService } from '../services/portfolio.service';

@ApiTags('Public Portfolio (F010)')
@Controller('public')
export class PublicPortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Public()
  @Get('portfolio/:username')
  @ApiOperation({
    summary: 'Public endpoint to view candidate portfolio, badges, skills, and certs',
  })
  async getPublicPortfolio(@Param('username') username: string) {
    return this.portfolioService.getPublicPortfolio(username);
  }
}
