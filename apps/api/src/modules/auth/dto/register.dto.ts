import { IsString, Length, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const shouldValidateOptionalString = (value: unknown) =>
  value !== undefined && value !== null && (typeof value !== 'string' || value.trim().length > 0);

const getTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

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

  @ValidateIf((dto: RegisterDto) => shouldValidateOptionalString(dto.invite_code))
  @IsString()
  @Length(6, 128)
  invite_code?: string;

  @ValidateIf((dto: RegisterDto) => shouldValidateOptionalString(dto.inviteCode))
  @IsString()
  @Length(6, 128)
  inviteCode?: string;
}

export const getRegisterPasswordConfirm = (dto: RegisterDto) => dto.password_confirm ?? dto.passwordConfirm ?? '';
export const getRegisterInviteCode = (dto: RegisterDto) => getTrimmedString(dto.invite_code) || getTrimmedString(dto.inviteCode);
