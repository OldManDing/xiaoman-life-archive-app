import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminUpdateMediaStatusDto {
  @IsIn(['ready', 'failed', 'removed'])
  status!: 'ready' | 'failed' | 'removed';

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason!: string;
}
