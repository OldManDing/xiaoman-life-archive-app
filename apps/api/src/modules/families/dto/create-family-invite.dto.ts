import { FamilyMemberRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class CreateFamilyInviteDto {
  @IsOptional()
  @IsString()
  @Matches(/^1\d{10}$/)
  mobile?: string;

  @IsEnum(FamilyMemberRole)
  role!: FamilyMemberRole;
}
