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
  // 精确过滤某个后台账号的操作记录（AuditLog.actorId 的字符串形式）。
  actor_id?: string;

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
