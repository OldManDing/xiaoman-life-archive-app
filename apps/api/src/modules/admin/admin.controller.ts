import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { AuthenticatedAdmin } from '../../shared/types';
import { AdminRoles } from './decorators/admin-roles.decorator';
import { AdminAuditLogListDto } from './dto/admin-audit-log-list.dto';
import { AdminListDto } from './dto/admin-list.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
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
  @Get('users')
  users(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminListDto, @Req() request: Request) {
    return this.adminService.listUsers(admin, dto, request);
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
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('children')
  children(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminListDto, @Req() request: Request) {
    return this.adminService.listChildren(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('records')
  records(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminListDto, @Req() request: Request) {
    return this.adminService.listRecords(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('media')
  media(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminListDto, @Req() request: Request) {
    return this.adminService.listMedia(admin, dto, request);
  }

  @UseGuards(AdminJwtAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.super_admin, AdminRole.operator, AdminRole.viewer)
  @Get('ai-jobs')
  aiJobs(@CurrentUser() admin: AuthenticatedAdmin, @Query() dto: AdminListDto, @Req() request: Request) {
    return this.adminService.listAiJobs(admin, dto, request);
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
