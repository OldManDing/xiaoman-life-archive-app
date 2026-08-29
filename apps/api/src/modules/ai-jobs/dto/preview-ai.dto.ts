import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class PreviewAiDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content_text?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  tags?: string[];
}
