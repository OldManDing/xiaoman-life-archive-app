import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ConfirmMediaDto {
  @IsString()
  media_no!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16384)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16384)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60 * 60)
  duration_seconds?: number | null;
}
