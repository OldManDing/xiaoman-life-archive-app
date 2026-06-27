import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminUpdateSupportTicketStatusDto {
  @IsIn(['processing', 'resolved', 'closed'])
  status!: 'processing' | 'resolved' | 'closed';

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  note!: string;
}
