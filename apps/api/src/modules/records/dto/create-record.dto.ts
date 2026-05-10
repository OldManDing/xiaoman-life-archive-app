import { IsArray, IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { RecordType } from '@prisma/client';

export class CreateRecordDto {
  @IsString()
  child_no!: string;

  @IsEnum(RecordType)
  record_type!: RecordType;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  title?: string;

  @IsOptional()
  @IsString()
  content_text?: string;

  @IsOptional()
  @IsArray()
  media_nos?: string[];

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsISO8601()
  event_time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  location_text?: string;

  @IsOptional()
  @IsString()
  visibility_scope?: string;

  @IsOptional()
  @IsBoolean()
  is_milestone?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}
