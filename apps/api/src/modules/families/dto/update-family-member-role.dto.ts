import { FamilyMemberRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateFamilyMemberRoleDto {
  @IsEnum(FamilyMemberRole)
  role!: FamilyMemberRole;
}
