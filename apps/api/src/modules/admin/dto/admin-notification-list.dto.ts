import { IsISO8601, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const readStates = ['unread', 'read'] as const;
const deliveryStatuses = ['queued', 'sent', 'failed', 'skipped'] as const;

export class AdminNotificationListDto {
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
  @IsIn(readStates)
  read_state?: (typeof readStates)[number];

  @IsOptional()
  @IsString()
  notification_type?: string;

  @IsOptional()
  @IsIn(deliveryStatuses)
  delivery_status?: (typeof deliveryStatuses)[number];

  @IsOptional()
  @IsISO8601()
  start_time?: string;

  @IsOptional()
  @IsISO8601()
  end_time?: string;
}
