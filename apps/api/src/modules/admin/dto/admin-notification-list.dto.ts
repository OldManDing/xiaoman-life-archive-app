import { IsISO8601, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const readStates = ['unread', 'read'] as const;
// processing 是推送 worker 在投递进行中写入的状态（huawei-push-delivery.service），
// 必须允许筛选，否则后台看不到「卡在投递中」的通知。
const deliveryStatuses = ['queued', 'processing', 'sent', 'failed', 'skipped'] as const;

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
