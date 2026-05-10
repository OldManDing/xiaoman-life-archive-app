import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminUpdateUserStatusDto {
  @IsIn(['active', 'disabled'])
  status!: 'active' | 'disabled';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
