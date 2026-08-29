import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ListArchiveExportRequestsDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  child_no?: string;

  @IsOptional()
  @IsIn(['all', 'media', 'text'])
  export_type?: 'all' | 'media' | 'text';

  @IsOptional()
  @IsIn(['backup', 'adult_handoff'])
  purpose?: 'backup' | 'adult_handoff';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;
}
