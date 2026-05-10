import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ChildGender } from '@prisma/client';

export class CreateChildDto {
  @IsString()
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsDateString()
  birthday!: string;

  @IsOptional()
  @IsEnum(ChildGender)
  gender?: ChildGender;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  birth_place?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
