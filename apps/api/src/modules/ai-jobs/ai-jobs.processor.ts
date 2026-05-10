import { Injectable, Logger } from '@nestjs/common';
import { AiJobStatus, AiJobType, RecordAiStatus, RecordTagSource } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';

@Injectable()
export class AiJobsProcessor {
  private readonly logger = new Logger(AiJobsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderService: AiProviderService,
  ) {}

  async process(jobId: bigint) {
    const aiJob = await this.prisma.aiJob.findUnique({
      where: { id: jobId },
      include: {
        record: {
          include: {
            tags: true,
          },
        },
      },
    });

    if (!aiJob || !aiJob.record) {
      this.logger.warn(`AI job ${jobId.toString()} missing record context`);
      return;
    }

    const startedAt = new Date();
    await this.prisma.aiJob.update({
      where: { id: aiJob.id },
      data: { status: AiJobStatus.processing, startedAt },
    });

    try {
      const output = await this.aiProviderService.run({
        jobType: aiJob.jobType,
        contentText: aiJob.record.contentText ?? '',
        title: aiJob.record.title ?? '',
        existingTags: aiJob.record.tags.map((item) => item.tagName),
      });

      await this.prisma.$transaction(async (tx) => {
        if (aiJob.jobType === AiJobType.record_title) {
          await tx.record.update({
            where: { id: aiJob.recordId! },
            data: { aiGeneratedTitle: String(output.suggested_title), aiStatus: RecordAiStatus.success },
          });
        }

        if (aiJob.jobType === AiJobType.record_summary) {
          await tx.record.update({
            where: { id: aiJob.recordId! },
            data: { aiSummary: String(output.summary), aiStatus: RecordAiStatus.success },
          });
        }

        if (aiJob.jobType === AiJobType.record_tags && Array.isArray(output.tags)) {
          await tx.recordTag.createMany({
            data: output.tags.map((tag) => ({
              recordId: aiJob.recordId!,
              tagName: String(tag),
              source: RecordTagSource.ai,
            })),
            skipDuplicates: true,
          });
          await tx.record.update({
            where: { id: aiJob.recordId! },
            data: { aiStatus: RecordAiStatus.success },
          });
        }

        await tx.aiJob.update({
          where: { id: aiJob.id },
          data: {
            status: AiJobStatus.success,
            outputJson: output,
            finishedAt: new Date(),
          },
        });
      });
    } catch (error) {
      const retryCount = aiJob.retryCount + 1;
      await this.prisma.aiJob.update({
        where: { id: aiJob.id },
        data: {
          status: AiJobStatus.failed,
          retryCount,
          errorMessage: error instanceof Error ? error.message : 'AI 处理失败',
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }
}
