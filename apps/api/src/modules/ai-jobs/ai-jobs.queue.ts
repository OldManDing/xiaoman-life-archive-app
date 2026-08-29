import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AiJobsProcessor } from './ai-jobs.processor';

const RECOVERY_INTERVAL_MS = 30_000;
const STALE_PROCESSING_MS = 15 * 60_000;
const RECOVERY_BATCH_SIZE = 50;

@Injectable()
export class AiJobsQueue implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private processing = false;

  constructor(
    private readonly processor: AiJobsProcessor,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    if (!this.prisma?.aiJob) return;
    void this.recoverPendingJobs();
    this.timer = setInterval(() => void this.recoverPendingJobs(), RECOVERY_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(jobId: bigint) {
    setTimeout(() => void this.processor.process(jobId), 0).unref?.();
  }

  private async recoverPendingJobs() {
    if (this.processing) return;
    this.processing = true;
    try {
      if (!this.prisma.aiJob?.updateMany || !this.prisma.aiJob?.findMany) return;
      const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
      await this.prisma.aiJob.updateMany({
        where: {
          status: 'processing',
          OR: [{ startedAt: null }, { startedAt: { lt: staleBefore } }],
        },
        data: { status: 'pending', startedAt: null, errorMessage: '任务已由系统恢复，等待重新处理' },
      });
      const jobs = await this.prisma.aiJob.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: RECOVERY_BATCH_SIZE,
        select: { id: true },
      });
      await Promise.all(jobs.map((job) => this.enqueue(job.id)));
    } catch (error) {
      console.warn(`AI 任务恢复扫描失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.processing = false;
    }
  }
}
