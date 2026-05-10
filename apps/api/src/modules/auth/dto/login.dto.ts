import { IsIn, IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsIn(['mobile'])
  login_type!: 'mobile';

  @IsString()
  @Matches(/^1\d{10}$/)
  credential!: string;

  @IsString()
  @Length(4, 8)
  verify_code!: string;
}
