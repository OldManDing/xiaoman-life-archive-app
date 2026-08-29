import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ArchiveExportSummaryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  child_no!: string;

  @IsOptional()
  @IsIn(['all', 'media', 'text'])
  export_type?: 'all' | 'media' | 'text';
}
