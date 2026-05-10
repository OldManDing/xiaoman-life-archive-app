import { IsISO8601, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AdminAuditLogListDto {
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
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  target_type?: string;

  @IsOptional()
  @IsISO8601()
  start_time?: string;

  @IsOptional()
  @IsISO8601()
  end_time?: string;
}
