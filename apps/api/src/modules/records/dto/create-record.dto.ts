import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { RecordType, VisibilityScope } from '@prisma/client';

export class CreateRecordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  child_no!: string;

  @IsEnum(RecordType)
  record_type!: RecordType;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content_text?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  media_nos?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  tags?: string[];

  @IsOptional()
  @IsISO8601()
  event_time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  location_text?: string;

  @IsOptional()
  @IsEnum(VisibilityScope)
  visibility_scope?: VisibilityScope;

  @IsOptional()
  @IsBoolean()
  is_milestone?: boolean;

  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: 'draft' | 'published';
}
