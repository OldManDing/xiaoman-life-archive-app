import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminUpdateSupportTicketStatusDto {
  @IsIn(['processing', 'resolved', 'closed'])
  status!: 'processing' | 'resolved' | 'closed';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
