import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../shared/types';
import { UserJwtAuthGuard } from '../auth/guards/user-jwt-auth.guard';
import { CreateAiJobDto } from './dto/create-ai-job.dto';
import { AiJobsService } from './ai-jobs.service';

@Controller()
@UseGuards(UserJwtAuthGuard)
export class AiJobsController {
  constructor(private readonly aiJobsService: AiJobsService) {}

  @Post('records/:record_no/ai-jobs')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('record_no') recordNo: string,
    @Body() dto: CreateAiJobDto,
  ) {
    return this.aiJobsService.create(user.id, recordNo, dto);
  }

  @Get('ai-jobs/:job_no')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('job_no') jobNo: string) {
    return this.aiJobsService.detail(user.id, jobNo);
  }
}
