import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TaxonomyService } from './taxonomy.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Taxonomies')
@Controller('taxonomies')
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Public()
  @Get('job-roles')
  @ApiOperation({ summary: 'Get list of active job roles' })
  @ApiResponse({ status: 200, description: 'Active job roles list' })
  async getJobRoles() {
    return this.taxonomyService.getJobRoles();
  }

  @Public()
  @Get('levels')
  @ApiOperation({ summary: 'Get list of active seniority levels' })
  @ApiResponse({ status: 200, description: 'Active seniority levels list' })
  async getSeniorityLevels() {
    return this.taxonomyService.getSeniorityLevels();
  }

  @Public()
  @Get('technologies')
  @ApiOperation({ summary: 'Get list of active technologies' })
  @ApiResponse({ status: 200, description: 'Active technologies list' })
  async getTechnologies() {
    return this.taxonomyService.getTechnologies();
  }
}
