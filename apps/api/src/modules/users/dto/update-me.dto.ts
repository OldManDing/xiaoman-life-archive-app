import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[^\u0000-\u001F\u007F]+$/u, { message: '昵称包含非法字符' })
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatar_url?: string;
}
