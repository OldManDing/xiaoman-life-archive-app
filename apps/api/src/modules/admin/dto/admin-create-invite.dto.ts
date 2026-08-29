import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AdminCreateInviteDto {
  @IsOptional()
  @IsString()
  @Matches(/^1\d{10}$/)
  mobile?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  expires_in_hours?: number;

  // 生成邀请码同样要求留痕原因，保持敏感操作审计口径一致。
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason?: string;
}
