import { Injectable } from '@nestjs/common';
import { AiJobType } from '@prisma/client';

import { getAiProviderName } from '../../shared/env-config';

@Injectable()
export class AiProviderService {
  async run(params: {
    jobType: AiJobType;
    contentText: string;
    title: string;
    existingTags: string[];
  }) {
    const provider = getAiProviderName();
    const plainText = params.contentText.trim() || params.title.trim() || '成长记录';

    if (provider !== 'mock') {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    switch (params.jobType) {
      case AiJobType.record_title:
        return { suggested_title: params.title || `${plainText.slice(0, 10)}${plainText.length > 10 ? '...' : ''}` };
      case AiJobType.record_summary:
        return { summary: plainText.slice(0, 60) };
      case AiJobType.record_tags:
        return {
          tags: Array.from(new Set([...params.existingTags, plainText.slice(0, 4), '成长']))
            .filter(Boolean)
            .slice(0, 5),
        };
      case AiJobType.monthly_report:
        return { summary: 'V1 mock monthly report' };
      default:
        return { summary: 'mock' };
    }
  }
}
