import { Module } from '@nestjs/common';

import { AiJobsController } from './ai-jobs.controller';
import { AiJobsProcessor } from './ai-jobs.processor';
import { AiJobsQueue } from './ai-jobs.queue';
import { AiJobsService } from './ai-jobs.service';
import { AiProviderService } from './ai-provider.service';

@Module({
  controllers: [AiJobsController],
  providers: [AiJobsService, AiJobsProcessor, AiJobsQueue, AiProviderService],
  exports: [AiJobsService],
})
export class AiJobsModule {}
