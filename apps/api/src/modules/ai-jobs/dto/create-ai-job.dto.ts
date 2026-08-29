import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum } from 'class-validator';
import { AiJobType } from '@prisma/client';

export class CreateAiJobDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(4)
  @IsEnum(AiJobType, { each: true })
  job_types!: AiJobType[];
}
