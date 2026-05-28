import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminUpdateArchiveExportRequestStatusDto {
  @IsIn(['processing', 'completed', 'rejected'])
  status!: 'processing' | 'completed' | 'rejected';

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  note?: string;
}
