import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminUpdateSystemConfigDto {
  @IsString()
  @MaxLength(1000)
  value!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason!: string;
}
