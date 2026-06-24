import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class ChangePasswordDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(8, 72)
  current_password!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(8, 12, { message: '新密码需为 8 到 12 位' })
  new_password!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(8, 12, { message: '确认新密码需为 8 到 12 位' })
  new_password_confirm!: string;
}
