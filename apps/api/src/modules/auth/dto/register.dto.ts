import { IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^\S+$/)
  credential!: string;

  @IsString()
  @Length(8, 72)
  password!: string;

  @IsString()
  @Length(8, 72)
  password_confirm!: string;

  @IsString()
  @Length(6, 128)
  invite_code!: string;
}
