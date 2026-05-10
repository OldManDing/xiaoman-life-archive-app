import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminAiJobActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
