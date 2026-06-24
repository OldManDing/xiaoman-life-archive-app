import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AiJobStatus, AiJobType, FamilyMemberRole, MembershipType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AccessControlService } from '../../shared/services/access-control.service';
import { RuntimeConfigService } from '../../shared/services/runtime-config.service';
import { generateBizNo } from '../../shared/utils';
import { AiJobsQueue } from './ai-jobs.queue';
import { AiProviderService } from './ai-provider.service';
import { CreateAiJobDto } from './dto/create-ai-job.dto';
import { PreviewAiDto } from './dto/preview-ai.dto';

@Injectable()
export class AiJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
    private readonly aiJobsQueue: AiJobsQueue,
    private readonly aiProviderService: AiProviderService,
    private readonly runtimeConfigService: RuntimeConfigService,
  ) {}

  async create(userId: bigint, recordNo: string, dto: CreateAiJobDto) {
    const { record, membership } = await this.accessControlService.ensureRecordReadable(userId, recordNo);
    if (membership.role !== FamilyMemberRole.owner && membership.role !== FamilyMemberRole.editor) {
      throw new ForbiddenException('无权限触发 AI');
    }
    await this.ensureAiPlusMember(userId);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const countToday = await this.prisma.aiJob.count({
      where: {
        requesterUserId: userId,
        createdAt: { gte: startOfDay },
      },
    });
    const dailyLimit = await this.runtimeConfigService.getAiDailyLimitPerUser();
    if (countToday + dto.job_types.length > dailyLimit) {
      throw new HttpException('调用频率超限', HttpStatus.TOO_MANY_REQUESTS);
    }

    const provider = await this.runtimeConfigService.getAiProviderName();
    const jobs = await this.prisma.$transaction(async (tx) => {
      const createdJobs = [] as Array<{ id: bigint; jobNo: string; jobType: AiJobType }>;
      for (const jobType of dto.job_types) {
        const job = await tx.aiJob.create({
          data: {
            jobNo: generateBizNo('job'),
            familyId: record.familyId,
            recordId: record.id,
            requesterUserId: userId,
            jobType,
            provider,
            status: AiJobStatus.pending,
            inputSnapshot: {
              record_no: record.recordNo,
              title: record.title,
              content_text: record.contentText,
              tags: record.tags.map((item) => item.tagName),
              event_time: record.eventTime.toISOString(),
            },
          },
        });
        createdJobs.push({ id: job.id, jobNo: job.jobNo, jobType: job.jobType });
      }
      return createdJobs;
    });

    for (const job of jobs) {
      await this.aiJobsQueue.enqueue(job.id);
    }

    return {
      list: await Promise.all(jobs.map((job) => this.detail(userId, job.jobNo))),
    };
  }

  async detail(userId: bigint, jobNo: string) {
    const job = await this.prisma.aiJob.findFirst({
      where: { jobNo },
      include: { record: true },
    });

    if (!job) {
      throw new NotFoundException('AI 任务不存在');
    }

    const membership = await this.prisma.familyMember.findFirst({
      where: {
        familyId: job.familyId,
        userId,
        deletedAt: null,
      },
    });
    if (!membership) {
      throw new ForbiddenException('无权限查看 AI 任务');
    }
    await this.ensureAiPlusMember(userId);

    return {
      job_no: job.jobNo,
      record_no: job.record?.recordNo ?? null,
      job_type: job.jobType,
      status: job.status,
      provider: job.provider,
      input_snapshot: job.inputSnapshot,
      output_json: job.outputJson,
      error_message: job.errorMessage,
      retry_count: job.retryCount,
      started_at: job.startedAt?.toISOString() ?? null,
      finished_at: job.finishedAt?.toISOString() ?? null,
      created_at: job.createdAt.toISOString(),
      updated_at: job.updatedAt.toISOString(),
    };
  }

  async preview(userId: bigint, dto: PreviewAiDto) {
    await this.ensureAiPlusMember(userId);

    const title = dto.title?.trim() ?? '';
    const contentText = dto.content_text?.trim() ?? '';
    const existingTags = dto.tags?.map((item) => item.trim()).filter(Boolean) ?? [];

    if (!title && !contentText) {
      throw new HttpException('请先输入标题或正文，再使用整理建议', HttpStatus.BAD_REQUEST);
    }

    const [titleOutput, summaryOutput, tagsOutput] = await Promise.all([
      this.aiProviderService.run({
        jobType: AiJobType.record_title,
        title,
        contentText,
        existingTags,
      }),
      this.aiProviderService.run({
        jobType: AiJobType.record_summary,
        title,
        contentText,
        existingTags,
      }),
      this.aiProviderService.run({
        jobType: AiJobType.record_tags,
        title,
        contentText,
        existingTags,
      }),
    ]);

    return {
      suggested_title: titleOutput.suggested_title ?? null,
      summary: summaryOutput.summary ?? null,
      tags: tagsOutput.tags ?? [],
      provider: await this.runtimeConfigService.getAiProviderName(),
    };
  }

  private async ensureAiPlusMember(userId: bigint) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        membershipType: true,
        membershipExpireAt: true,
      },
    });

    const isAiPlus =
      user?.membershipType === MembershipType.ai_plus &&
      (!user.membershipExpireAt || user.membershipExpireAt.getTime() > Date.now());

    if (!isAiPlus) {
      throw new ForbiddenException('AI 功能仅对 AI 会员开放');
    }
  }
}
