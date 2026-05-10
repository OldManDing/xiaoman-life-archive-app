import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateMeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[^\u0000-\u001F\u007F]+$/u, { message: '昵称包含非法字符' })
  nickname!: string;
}
