import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

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
}
