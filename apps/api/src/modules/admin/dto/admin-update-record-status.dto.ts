import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminUpdateRecordStatusDto {
  @IsIn(['published', 'draft'])
  status!: 'published' | 'draft';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
