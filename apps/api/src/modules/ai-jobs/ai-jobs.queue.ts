import { Injectable } from '@nestjs/common';

import { AiJobsProcessor } from './ai-jobs.processor';

@Injectable()
export class AiJobsQueue {
  constructor(private readonly processor: AiJobsProcessor) {}

  async enqueue(jobId: bigint) {
    setTimeout(() => {
      void this.processor.process(jobId);
    }, 0);
  }
}
