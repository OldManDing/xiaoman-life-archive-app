import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ChildGender } from '@prisma/client';

export class CreateChildDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatar_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cover_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

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
  @MaxLength(128)
  birth_hospital?: string;

  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(250)
  height_cm?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  weight_kg?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(24, { each: true })
  interest_tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  privacy_note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
