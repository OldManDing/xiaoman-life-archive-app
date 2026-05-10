import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmMediaDto {
  @IsString()
  media_no!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  duration_seconds?: number | null;
}
