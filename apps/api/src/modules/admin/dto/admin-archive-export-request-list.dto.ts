import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AdminArchiveExportRequestListDto {
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
  @IsIn(['backup', 'adult_handoff'])
  purpose?: 'backup' | 'adult_handoff';

  @IsOptional()
  @IsIn(['submitted', 'processing', 'completed', 'rejected'])
  status?: 'submitted' | 'processing' | 'completed' | 'rejected';
}
