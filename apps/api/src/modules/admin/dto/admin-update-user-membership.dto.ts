import { IsISO8601, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminUpdateUserMembershipDto {
  @IsIn(['free', 'family_member', 'ai_plus'])
  membership_type!: 'free' | 'family_member' | 'ai_plus';

  @IsOptional()
  @IsISO8601()
  membership_expire_at?: string | null;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason!: string;
}
