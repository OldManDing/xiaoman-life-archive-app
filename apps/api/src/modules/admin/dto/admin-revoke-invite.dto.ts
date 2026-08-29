import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminRevokeInviteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason!: string;
}
