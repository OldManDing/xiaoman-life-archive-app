import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AdminListDto {
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
}

export const adminRecordFilters = ['all', 'image', 'video', 'audio', 'media_exception', 'pending', 'risk'] as const;

export type AdminRecordFilter = (typeof adminRecordFilters)[number];

export class AdminRecordListDto extends AdminListDto {
  @IsOptional()
  @IsIn(adminRecordFilters)
  record_filter?: AdminRecordFilter;
}
