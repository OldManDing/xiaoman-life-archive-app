import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { getAuthRateLimitMaxAttempts, getAuthRateLimitWindowMs } from '../../shared/env-config';
import { AuthenticatedAdmin } from '../../shared/types';
import { AdminAiJobActionDto } from './dto/admin-ai-job-action.dto';
import { AdminArchiveExportRequestListDto } from './dto/admin-archive-export-request-list.dto';
import { AdminContentRiskListDto } from './dto/admin-content-risk-list.dto';
import { AdminRoles } from './decorators/admin-roles.decorator';
import { AdminAuditLogListDto } from './dto/admin-audit-log-list.dto';
import { AdminCreateInviteDto } from './dto/admin-create-invite.dto';
import { AdminListDto } from './dto/admin-list.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminResetUserPasswordDto } from './dto/admin-reset-user-password.dto';
import { AdminUpdateMediaStatusDto } from './dto/admin-update-media-status.dto';
import { AdminUpdateArchiveExportRequestStatusDto } from './dto/admin-update-archive-export-request-status.dto';
import { AdminUpdateSystemConfigDto } from './dto/admin-update-system-config.dto';
import { AdminUpdateUserMembershipDto } from './dto/admin-update-user-membership.dto';
import { AdminUpdateRecordStatusDto } from './dto/admin-update-record-status.dto';
import { AdminSupportTicketListDto } from './dto/admin-support-ticket-list.dto';
import { AdminUpdateSupportTicketStatusDto } from './dto/admin-update-support-ticket-status.dto';
import { AdminUpdateUserStatusDto } from './dto/admin-update-user-status.dto';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { AdminService } from './admin.service';
import { AdminRole } from '@prisma/client';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Throttle({
    default: {
      limit: () => getAuthRateLimitMaxAttempts(),
      ttl: () => getAuthRateLimitWindowMs(),
    },
  })
  @UseGuards(ThrottlerGuard)
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
  @Get('ops-readiness')
  opsReadiness(@CurrentUser() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.adminService.opsReadiness(admin, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('system-configs')
  systemConfigs(@CurrentUser() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.adminService.listSystemConfigs(admin, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator)
  @Patch('system-configs/:config_key')
  updateSystemConfig(
    @CurrentUser() admin: AuthenticatedAdmin,
    @Param('config_key') configKey: string,
    @Body() dto: AdminUpdateSystemConfigDto,
    @Req() request: Request,
  ) {
    return this.adminService.updateSystemConfig(admin, configKey, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('users')
  users(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminListDto, @Req() request: Request) {
    return this.adminService.listUsers(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('families')
  families(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminListDto, @Req() request: Request) {
    return this.adminService.listFamilies(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('families/:family_no')
  familyDetail(@CurrentUser() admin: AuthenticatedAdmin, @Param('family_no') familyNo: string, @Req() request: Request) {
    return this.adminService.familyDetail(admin, familyNo, request);
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
  @AdminRoles(AdminRole.super_admin, AdminRole.operator)
  @Patch('users/:user_no/membership')
  updateUserMembership(
    @CurrentUser() admin: AuthenticatedAdmin,
    @Param('user_no') userNo: string,
    @Body() dto: AdminUpdateUserMembershipDto,
    @Req() request: Request,
  ) {
    return this.adminService.updateUserMembership(admin, userNo, dto, request);
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
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('content-risks')
  contentRisks(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminContentRiskListDto, @Req() request: Request) {
    return this.adminService.listContentRisks(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('support-tickets')
  supportTickets(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminSupportTicketListDto, @Req() request: Request) {
    return this.adminService.listSupportTickets(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator)
  @Patch('support-tickets/:ticket_no/status')
  updateSupportTicketStatus(
    @CurrentUser() admin: AuthenticatedAdmin,
    @Param('ticket_no') ticketNo: string,
    @Body() dto: AdminUpdateSupportTicketStatusDto,
    @Req() request: Request,
  ) {
    return this.adminService.updateSupportTicketStatus(admin, ticketNo, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('archive-export-requests')
  archiveExportRequests(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminArchiveExportRequestListDto, @Req() request: Request) {
    return this.adminService.listArchiveExportRequests(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator)
  @Patch('archive-export-requests/:request_no/status')
  updateArchiveExportRequestStatus(
    @CurrentUser() admin: AuthenticatedAdmin,
    @Param('request_no') requestNo: string,
    @Body() dto: AdminUpdateArchiveExportRequestStatusDto,
    @Req() request: Request,
  ) {
    return this.adminService.updateArchiveExportRequestStatus(admin, requestNo, dto, request);
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
