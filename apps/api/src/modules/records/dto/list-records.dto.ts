import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { RecordType } from '@prisma/client';

export class ListRecordsDto {
  @IsString()
  child_no!: string;

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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  keyword?: string;

  @IsOptional()
  @IsEnum(RecordType)
  record_type?: RecordType;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(32)
  tag?: string;

  @IsOptional()
  @IsISO8601()
  start_time?: string;

  @IsOptional()
  @IsISO8601()
  end_time?: string;

  @IsOptional()
  @IsIn(['published', 'draft'])
  status?: 'published' | 'draft';
}
