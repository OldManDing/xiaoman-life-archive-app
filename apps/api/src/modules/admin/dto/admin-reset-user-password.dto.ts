import { IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class AdminResetUserPasswordDto {
  @IsString()
  @Length(8, 12, { message: '新密码需为 8 到 12 位' })
  // 与 App 注册规则保持一致（8-12 位），同时要求必须包含字母和数字，拒绝纯数字等弱口令。
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)\S+$/, { message: '新密码必须同时包含字母和数字' })
  new_password!: string;

  @IsString()
  @Length(8, 12, { message: '确认密码需为 8 到 12 位' })
  password_confirm!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason!: string;
}
