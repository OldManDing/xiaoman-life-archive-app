import { IsIn, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsIn(['password'])
  login_type!: 'password';

  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^\S+$/)
  credential!: string;

  @IsString()
  @Length(8, 72)
  password!: string;
}
