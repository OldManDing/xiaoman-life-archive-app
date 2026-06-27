import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUrl, Length, MaxLength, MinLength } from 'class-validator';

export class AdminUpdateArchiveExportRequestStatusDto {
  @IsIn(['processing', 'completed', 'rejected'])
  status!: 'processing' | 'completed' | 'rejected';

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  note!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(512)
  download_url?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(64, 64)
  file_sha256?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  delivery_evidence?: string;
}
