import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class DeleteMeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(8, 72)
  password!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^确认注销$/u, { message: '请输入“确认注销”以继续' })
  confirm_text!: string;
}
