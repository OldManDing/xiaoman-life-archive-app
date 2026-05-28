import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { AdminListDto } from './admin-list.dto';

export class AdminSupportTicketListDto extends AdminListDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsOptional()
  @IsIn(['submitted', 'processing', 'resolved', 'closed'])
  status?: 'submitted' | 'processing' | 'resolved' | 'closed';

  @IsOptional()
  @IsIn(['normal', 'urgent', 'child_safety'])
  priority?: 'normal' | 'urgent' | 'child_safety';
}
