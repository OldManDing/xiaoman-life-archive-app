import { Injectable, Logger } from '@nestjs/common';
import { AiJobStatus, AiJobType, RecordAiStatus, RecordTagSource } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';

const PUBLIC_AI_JOB_ERROR_MESSAGE = '智能整理暂时不可用，请稍后重试或手动填写内容。';

@Injectable()
export class AiJobsProcessor {
  private readonly logger = new Logger(AiJobsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderService: AiProviderService,
  ) {}

  async process(jobId: bigint) {
    const startedAt = new Date();
    const claimed = await this.prisma.aiJob.updateMany({
      where: { id: jobId, status: AiJobStatus.pending },
      data: { status: AiJobStatus.processing, startedAt, errorMessage: null },
    });
    if (!claimed.count) {
      return;
    }

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
      await this.prisma.aiJob.updateMany({
        where: { id: jobId, status: AiJobStatus.processing },
        data: { status: AiJobStatus.cancelled, errorMessage: '关联记录不存在', finishedAt: new Date() },
      });
      return;
    }

    if (aiJob.record.deletedAt) {
      await this.prisma.aiJob.updateMany({
        where: { id: jobId, status: AiJobStatus.processing },
        data: { status: AiJobStatus.cancelled, errorMessage: '关联记录已删除', finishedAt: new Date() },
      });
      return;
    }

    try {
      const output = await this.aiProviderService.run({
        jobType: aiJob.jobType,
        contentText: aiJob.record.contentText ?? '',
        title: aiJob.record.title ?? '',
        existingTags: aiJob.record.tags.map((item) => item.tagName),
      });

      await this.prisma.$transaction(async (tx) => {
        const latest = await tx.aiJob.findUnique({ where: { id: aiJob.id }, select: { status: true } });
        if (latest?.status !== AiJobStatus.processing) return;

        const currentRecord = await tx.record.findUnique({
          where: { id: aiJob.recordId! },
          select: { deletedAt: true, updatedAt: true },
        });
        const snapshot = this.readInputSnapshot(aiJob.inputSnapshot);
        const snapshotUpdatedAt = typeof snapshot.record_updated_at === 'string' || typeof snapshot.record_updated_at === 'number'
          ? new Date(snapshot.record_updated_at)
          : null;
        if (!currentRecord || currentRecord.deletedAt || (snapshotUpdatedAt && currentRecord.updatedAt.getTime() !== snapshotUpdatedAt.getTime())) {
          await tx.aiJob.update({
            where: { id: aiJob.id },
            data: { status: AiJobStatus.cancelled, errorMessage: '记录已删除或已修改，AI 结果已忽略', finishedAt: new Date() },
          });
          return;
        }

        const safeOutput = this.sanitizeOutput(output);
        if (aiJob.jobType === AiJobType.record_title) {
          await tx.record.update({
            where: { id: aiJob.recordId! },
            data: { aiGeneratedTitle: safeOutput.suggested_title ?? null },
          });
        }

        if (aiJob.jobType === AiJobType.record_summary) {
          await tx.record.update({
            where: { id: aiJob.recordId! },
            data: { aiSummary: safeOutput.summary ?? null },
          });
        }

        if (aiJob.jobType === AiJobType.record_tags && safeOutput.tags.length) {
          await tx.recordTag.createMany({
            data: safeOutput.tags.map((tag) => ({
              recordId: aiJob.recordId!,
              tagName: String(tag),
              source: RecordTagSource.ai,
            })),
            skipDuplicates: true,
          });
        }

        await this.refreshRecordAiStatus(tx, aiJob.recordId!);

        await tx.aiJob.update({
          where: { id: aiJob.id },
          data: {
            status: AiJobStatus.success,
            outputJson: safeOutput,
            finishedAt: new Date(),
          },
        });
      });
    } catch (error) {
      const retryCount = aiJob.retryCount + 1;
      const failed = await this.prisma.aiJob.updateMany({
        where: { id: aiJob.id, status: AiJobStatus.processing },
        data: {
          status: AiJobStatus.failed,
          retryCount,
          errorMessage: PUBLIC_AI_JOB_ERROR_MESSAGE,
          finishedAt: new Date(),
        },
      });
      if (failed.count) await this.refreshRecordAiStatus(this.prisma, aiJob.recordId!);
      throw error;
    }
  }

  private readInputSnapshot(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, unknown>;
    return value as Record<string, unknown>;
  }

  private sanitizeOutput(output: { suggested_title?: unknown; summary?: unknown; tags?: unknown }) {
    const suggestedTitle = typeof output.suggested_title === 'string' ? output.suggested_title.trim().slice(0, 80) : null;
    const summary = typeof output.summary === 'string' ? output.summary.trim().slice(0, 500) : null;
    const tags = Array.isArray(output.tags)
      ? Array.from(
          new Set(
            output.tags
              .filter((tag): tag is string => typeof tag === 'string')
              .map((tag) => tag.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 32))
              .filter(Boolean),
          ),
        ).slice(0, 10)
      : [];
    return { suggested_title: suggestedTitle, summary, tags };
  }

  private async refreshRecordAiStatus(tx: Pick<PrismaService, 'aiJob' | 'record'>, recordId: bigint) {
    const jobs = await tx.aiJob.findMany({ where: { recordId }, select: { status: true } });
    const status = jobs.some((job) => job.status === AiJobStatus.pending || job.status === AiJobStatus.processing)
      ? RecordAiStatus.pending
      : jobs.some((job) => job.status === AiJobStatus.success)
        ? RecordAiStatus.success
        : jobs.some((job) => job.status === AiJobStatus.failed)
          ? RecordAiStatus.failed
          : RecordAiStatus.skipped;
    await tx.record.updateMany({ where: { id: recordId, deletedAt: null }, data: { aiStatus: status } });
  }
}
