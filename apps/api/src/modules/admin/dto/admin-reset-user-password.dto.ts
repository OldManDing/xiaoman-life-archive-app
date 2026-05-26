import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class AdminResetUserPasswordDto {
  @IsString()
  @Length(8, 72)
  new_password!: string;

  @IsString()
  @Length(8, 72)
  password_confirm!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason!: string;
}
