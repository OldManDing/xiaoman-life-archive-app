import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminUpdateMediaStatusDto {
  @IsIn(['ready', 'failed', 'removed'])
  status!: 'ready' | 'failed' | 'removed';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
