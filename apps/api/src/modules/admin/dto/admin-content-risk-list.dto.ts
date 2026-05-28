import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const contentRiskCategories = ['content_safety', 'media_exception', 'child_safety', 'ai_exception'] as const;
const contentRiskSeverities = ['p0', 'p1', 'p2'] as const;
const contentRiskStatuses = ['open', 'processing', 'resolved'] as const;

export class AdminContentRiskListDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(contentRiskCategories)
  category?: (typeof contentRiskCategories)[number];

  @IsOptional()
  @IsIn(contentRiskSeverities)
  severity?: (typeof contentRiskSeverities)[number];

  @IsOptional()
  @IsIn(contentRiskStatuses)
  status?: (typeof contentRiskStatuses)[number];
}
