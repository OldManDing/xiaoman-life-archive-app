import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class PreviewAiDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  title?: string;

  @IsOptional()
  @IsString()
  content_text?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}
