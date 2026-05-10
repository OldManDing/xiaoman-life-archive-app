import { IsEnum, IsInt, IsString, Max, Min } from 'class-validator';

export class CreateUploadTokenDto {
  @IsString()
  child_no!: string;

  @IsString()
  file_name!: string;

  @IsString()
  mime_type!: string;

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  size_bytes!: number;

  @IsString()
  @IsEnum({ image: 'image' })
  media_type!: 'image';
}
