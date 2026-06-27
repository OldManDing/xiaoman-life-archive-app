import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, Min, Max, IsInt, MinLength } from 'class-validator';

export class AdminUpdateAiSettingsDto {
  @IsIn(['openai-compatible', 'openai', 'mock'])
  provider!: 'openai-compatible' | 'openai' | 'mock';

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(512)
  base_url!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  model!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  api_key?: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1000)
  @Max(120000)
  timeout_ms!: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1000)
  daily_limit_per_user!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason!: string;
}
