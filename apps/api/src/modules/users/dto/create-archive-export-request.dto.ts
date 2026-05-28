import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateArchiveExportRequestDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  child_no!: string;

  @IsOptional()
  @IsIn(['all', 'media', 'text'])
  export_type?: 'all' | 'media' | 'text';

  @IsOptional()
  @IsIn(['backup', 'adult_handoff'])
  purpose?: 'backup' | 'adult_handoff';

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  contact?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  note?: string;
}
