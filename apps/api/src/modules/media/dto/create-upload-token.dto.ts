import { IsEnum, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

const mediaTypeValues = {
  image: 'image',
  video: 'video',
  audio: 'audio',
} as const;

export class CreateUploadTokenDto {
  @IsString()
  child_no!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  file_name!: string;

  @IsString()
  @MaxLength(128)
  mime_type!: string;

  @IsInt()
  @Min(1)
  @Max(200 * 1024 * 1024)
  size_bytes!: number;

  @IsString()
  @IsEnum(mediaTypeValues)
  media_type!: keyof typeof mediaTypeValues;
}
