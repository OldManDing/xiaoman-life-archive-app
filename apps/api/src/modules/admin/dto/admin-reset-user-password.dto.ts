import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class AdminResetUserPasswordDto {
  @IsString()
  @Length(8, 12, { message: '新密码需为 8 到 12 位' })
  new_password!: string;

  @IsString()
  @Length(8, 12, { message: '确认密码需为 8 到 12 位' })
  password_confirm!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason!: string;
}
