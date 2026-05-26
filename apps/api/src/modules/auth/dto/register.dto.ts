import { IsString, Length, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^\S+$/)
  credential!: string;

  @IsString()
  @Length(8, 72)
  password!: string;

  @ValidateIf((dto: RegisterDto) => dto.password_confirm !== undefined || dto.passwordConfirm === undefined)
  @IsString()
  @Length(8, 72)
  password_confirm?: string;

  @ValidateIf((dto: RegisterDto) => dto.password_confirm === undefined)
  @IsString()
  @Length(8, 72)
  passwordConfirm?: string;

  @ValidateIf((dto: RegisterDto) => dto.invite_code !== undefined || dto.inviteCode === undefined)
  @IsString()
  @Length(6, 128)
  invite_code?: string;

  @ValidateIf((dto: RegisterDto) => dto.invite_code === undefined)
  @IsString()
  @Length(6, 128)
  inviteCode?: string;
}

export const getRegisterPasswordConfirm = (dto: RegisterDto) => dto.password_confirm ?? dto.passwordConfirm ?? '';
export const getRegisterInviteCode = (dto: RegisterDto) => dto.invite_code ?? dto.inviteCode ?? '';
