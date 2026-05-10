import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AiJobStatus, AiJobType, FamilyMemberRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AccessControlService } from '../../shared/services/access-control.service';
import { getAiProviderName } from '../../shared/env-config';
import { generateBizNo } from '../../shared/utils';
import { AiJobsQueue } from './ai-jobs.queue';
import { CreateAiJobDto } from './dto/create-ai-job.dto';

@Injectable()
export class AiJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
    private readonly aiJobsQueue: AiJobsQueue,
  ) {}

  async create(userId: bigint, recordNo: string, dto: CreateAiJobDto) {
    const { record, membership } = await this.accessControlService.ensureRecordReadable(userId, recordNo);
    if (membership.role !== FamilyMemberRole.owner && membership.role !== FamilyMemberRole.editor) {
      throw new ForbiddenException('无权限触发 AI');
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const countToday = await this.prisma.aiJob.count({
      where: {
        requesterUserId: userId,
        createdAt: { gte: startOfDay },
      },
    });
    const dailyLimit = Number(process.env.AI_DAILY_LIMIT_PER_USER ?? 20);
    if (countToday + dto.job_types.length > dailyLimit) {
      throw new HttpException('调用频率超限', HttpStatus.TOO_MANY_REQUESTS);
    }

    const jobs = await this.prisma.$transaction(async (tx) => {
      const createdJobs = [] as Array<{ id: bigint; jobNo: string; jobType: AiJobType }>;
      const provider = getAiProviderName();
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

}
