import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../shared/types';
import { UserJwtAuthGuard } from '../auth/guards/user-jwt-auth.guard';
import { CreateFamilyInviteDto } from './dto/create-family-invite.dto';
import { UpdateFamilyMemberRoleDto } from './dto/update-family-member-role.dto';
import { FamiliesService } from './families.service';

@Controller()
@UseGuards(UserJwtAuthGuard)
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Get('families/:family_no/members')
  listMembers(@CurrentUser() user: AuthenticatedUser, @Param('family_no') familyNo: string) {
    return this.familiesService.listMembers(user.id, familyNo);
  }

  @Post('families/:family_no/invites')
  createInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('family_no') familyNo: string,
    @Body() dto: CreateFamilyInviteDto,
  ) {
    return this.familiesService.createInvite(user.id, familyNo, dto);
  }

  @Put('families/:family_no/members/:user_no/role')
  updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('family_no') familyNo: string,
    @Param('user_no') userNo: string,
    @Body() dto: UpdateFamilyMemberRoleDto,
  ) {
    return this.familiesService.updateMemberRole(user.id, familyNo, userNo, dto);
  }
}
