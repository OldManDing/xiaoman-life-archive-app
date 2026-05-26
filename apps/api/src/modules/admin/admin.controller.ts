import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { AuthenticatedAdmin } from '../../shared/types';
import { AdminAiJobActionDto } from './dto/admin-ai-job-action.dto';
import { AdminRoles } from './decorators/admin-roles.decorator';
import { AdminAuditLogListDto } from './dto/admin-audit-log-list.dto';
import { AdminCreateInviteDto } from './dto/admin-create-invite.dto';
import { AdminListDto } from './dto/admin-list.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminResetUserPasswordDto } from './dto/admin-reset-user-password.dto';
import { AdminUpdateMediaStatusDto } from './dto/admin-update-media-status.dto';
import { AdminUpdateRecordStatusDto } from './dto/admin-update-record-status.dto';
import { AdminUpdateUserStatusDto } from './dto/admin-update-user-status.dto';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { AdminService } from './admin.service';
import { AdminRole } from '@prisma/client';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Post('auth/login')
  login(@Body() dto: AdminLoginDto, @Req() request: Request) {
    return this.adminService.login(dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('dashboard')
  dashboard(@CurrentUser() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.adminService.dashboard(admin, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('users')
  users(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminListDto, @Req() request: Request) {
    return this.adminService.listUsers(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('invites')
  invites(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminListDto, @Req() request: Request) {
    return this.adminService.listInvites(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator)
  @Post('invites')
  createInvite(@CurrentUser() admin: AuthenticatedAdmin, @Body() dto: AdminCreateInviteDto, @Req() request: Request) {
    return this.adminService.createInvite(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator)
  @Post('invites/:invite_no/revoke')
  revokeInvite(@CurrentUser() admin: AuthenticatedAdmin, @Param('invite_no') inviteNo: string, @Req() request: Request) {
    return this.adminService.revokeInvite(admin, inviteNo, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('users/:user_no')
  userDetail(@CurrentUser() admin: AuthenticatedAdmin, @Param('user_no') userNo: string, @Req() request: Request) {
    return this.adminService.userDetail(admin, userNo, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator)
  @Patch('users/:user_no/status')
  updateUserStatus(
    @CurrentUser() admin: AuthenticatedAdmin,
    @Param('user_no') userNo: string,
    @Body() dto: AdminUpdateUserStatusDto,
    @Req() request: Request,
  ) {
    return this.adminService.updateUserStatus(admin, userNo, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin)
  @Patch('users/:user_no/password')
  resetUserPassword(
    @CurrentUser() admin: AuthenticatedAdmin,
    @Param('user_no') userNo: string,
    @Body() dto: AdminResetUserPasswordDto,
    @Req() request: Request,
  ) {
    return this.adminService.resetUserPassword(admin, userNo, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('children')
  children(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminListDto, @Req() request: Request) {
    return this.adminService.listChildren(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('children/:child_no')
  childDetail(@CurrentUser() admin: AuthenticatedAdmin, @Param('child_no') childNo: string, @Req() request: Request) {
    return this.adminService.childDetail(admin, childNo, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('records')
  records(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminListDto, @Req() request: Request) {
    return this.adminService.listRecords(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('records/:record_no')
  recordDetail(@CurrentUser() admin: AuthenticatedAdmin, @Param('record_no') recordNo: string, @Req() request: Request) {
    return this.adminService.recordDetail(admin, recordNo, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator)
  @Patch('records/:record_no/status')
  updateRecordStatus(
    @CurrentUser() admin: AuthenticatedAdmin,
    @Param('record_no') recordNo: string,
    @Body() dto: AdminUpdateRecordStatusDto,
    @Req() request: Request,
  ) {
    return this.adminService.updateRecordStatus(admin, recordNo, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('media')
  media(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminListDto, @Req() request: Request) {
    return this.adminService.listMedia(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('media/:media_no')
  mediaDetail(@CurrentUser() admin: AuthenticatedAdmin, @Param('media_no') mediaNo: string, @Req() request: Request) {
    return this.adminService.mediaDetail(admin, mediaNo, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator)
  @Patch('media/:media_no/status')
  updateMediaStatus(
    @CurrentUser() admin: AuthenticatedAdmin,
    @Param('media_no') mediaNo: string,
    @Body() dto: AdminUpdateMediaStatusDto,
    @Req() request: Request,
  ) {
    return this.adminService.updateMediaStatus(admin, mediaNo, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('ai-jobs')
  aiJobs(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminListDto, @Req() request: Request) {
    return this.adminService.listAiJobs(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('ai-jobs/:job_no')
  aiJobDetail(@CurrentUser() admin: AuthenticatedAdmin, @Param('job_no') jobNo: string, @Req() request: Request) {
    return this.adminService.aiJobDetail(admin, jobNo, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator)
  @Post('ai-jobs/:job_no/retry')
  retryAiJob(
    @CurrentUser() admin: AuthenticatedAdmin,
    @Param('job_no') jobNo: string,
    @Body() dto: AdminAiJobActionDto,
    @Req() request: Request,
  ) {
    return this.adminService.retryAiJob(admin, jobNo, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator)
  @Post('ai-jobs/:job_no/cancel')
  cancelAiJob(
    @CurrentUser() admin: AuthenticatedAdmin,
    @Param('job_no') jobNo: string,
    @Body() dto: AdminAiJobActionDto,
    @Req() request: Request,
  ) {
    return this.adminService.cancelAiJob(admin, jobNo, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin)
  @Get('audit-logs')
  auditLogs(
    @CurrentUser() admin: AuthenticatedAdmin,
    @Query() dto: AdminAuditLogListDto,
    @Req() request: Request,
  ) {
    return this.adminService.listAuditLogs(admin, dto, request);
  }
}
