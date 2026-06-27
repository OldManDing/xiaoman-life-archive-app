import { IsISO8601, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const mediaTypes = ['image', 'video', 'audio'] as const;
const mediaStatuses = ['uploading', 'ready', 'failed', 'removed'] as const;
const mediaLinkedStates = ['linked', 'unlinked'] as const;

export class AdminMediaListDto {
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
  @IsIn(mediaTypes)
  media_type?: (typeof mediaTypes)[number];

  @IsOptional()
  @IsIn(mediaStatuses)
  status?: (typeof mediaStatuses)[number];

  @IsOptional()
  @IsString()
  child_no?: string;

  @IsOptional()
  @IsString()
  family_no?: string;

  @IsOptional()
  @IsString()
  uploader_user_no?: string;

  @IsOptional()
  @IsIn(mediaLinkedStates)
  linked?: (typeof mediaLinkedStates)[number];

  @IsOptional()
  @IsISO8601()
  start_time?: string;

  @IsOptional()
  @IsISO8601()
  end_time?: string;
}
