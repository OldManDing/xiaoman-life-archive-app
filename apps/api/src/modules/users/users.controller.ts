import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';

import { REFRESH_TOKEN_COOKIE_NAME } from '../../shared/constants';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { getRefreshCookieOptions } from '../../shared/auth-cookie';
import { AuthenticatedUser } from '../../shared/types';
import { UserJwtAuthGuard } from '../auth/guards/user-jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ArchiveExportSummaryDto } from './dto/archive-export-summary.dto';
import { CheckAppUpdateDto } from './dto/check-app-update.dto';
import { CreateArchiveExportRequestDto } from './dto/create-archive-export-request.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { CreateMembershipBookRequestDto } from './dto/create-membership-book-request.dto';
import { DeleteMeDto } from './dto/delete-me.dto';
import { ListArchiveExportRequestsDto } from './dto/list-archive-export-requests.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(UserJwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.me(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Post('me/password')
  @HttpCode(200)
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto, @Req() request: Request) {
    return this.usersService.changePassword(user.id, dto, this.getAuditRequestMeta(request));
  }

  @Get('me/preferences')
  preferences(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.preferences(user.id);
  }

  @Put('me/preferences')
  updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePreferencesDto, @Req() request: Request) {
    return this.usersService.updatePreferences(user.id, dto, this.getAuditRequestMeta(request));
  }

  @Get('me/notifications')
  listNotifications(@CurrentUser() user: AuthenticatedUser, @Query() dto: ListNotificationsDto) {
    return this.usersService.listNotifications(user.id, dto);
  }

  @Get('me/notifications/unread-count')
  notificationUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.notificationUnreadCount(user.id);
  }

  @Patch('me/notifications/read-all')
  @HttpCode(200)
  markAllNotificationsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.markAllNotificationsRead(user.id);
  }

  @Patch('me/notifications/:notification_no/read')
  @HttpCode(200)
  markNotificationRead(@CurrentUser() user: AuthenticatedUser, @Param('notification_no') notificationNo: string) {
    return this.usersService.markNotificationRead(user.id, notificationNo);
  }

  @Post('me/device-tokens')
  @HttpCode(200)
  registerDeviceToken(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterDeviceTokenDto) {
    return this.usersService.registerDeviceToken(user.id, dto);
  }

  @Get('me/app-update')
  checkAppUpdate(@CurrentUser() user: AuthenticatedUser, @Query() dto: CheckAppUpdateDto) {
    return this.usersService.checkAppUpdate(user.id, dto);
  }

  @Post('me/feedback')
  @HttpCode(200)
  submitFeedback(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFeedbackDto, @Req() request: Request) {
    return this.usersService.submitFeedback(user.id, dto, this.getAuditRequestMeta(request));
  }

  @Get('me/feedback')
  listFeedback(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listFeedback(user.id);
  }

  @Get('me/membership-book-requests')
  listMembershipBookRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listMembershipBookRequests(user.id);
  }

  @Post('me/membership-book-requests')
  @HttpCode(200)
  requestMembershipBook(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMembershipBookRequestDto, @Req() request: Request) {
    return this.usersService.requestMembershipBook(user.id, dto, this.getAuditRequestMeta(request));
  }

  @Post('me/archive-export-requests')
  @HttpCode(200)
  requestArchiveExport(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateArchiveExportRequestDto, @Req() request: Request) {
    return this.usersService.requestArchiveExport(user.id, dto, this.getAuditRequestMeta(request));
  }

  @Get('me/archive-export-requests')
  listArchiveExportRequests(@CurrentUser() user: AuthenticatedUser, @Query() dto: ListArchiveExportRequestsDto) {
    return this.usersService.listArchiveExportRequests(user.id, dto);
  }

  @Get('me/archive-export-summary')
  archiveExportSummary(@CurrentUser() user: AuthenticatedUser, @Query() dto: ArchiveExportSummaryDto, @Req() request: Request) {
    return this.usersService.archiveExportSummary(user.id, dto, this.getAuditRequestMeta(request));
  }

  @Get('me/deletion-check')
  deletionCheck(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deletionCheck(user.id);
  }

  @Post('me/delete')
  @HttpCode(200)
  async deleteMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeleteMeDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.usersService.deleteMe(user.id, dto);
    const cookieOptions = getRefreshCookieOptions();
    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: cookieOptions.httpOnly,
      sameSite: cookieOptions.sameSite,
      secure: cookieOptions.secure,
      path: cookieOptions.path,
    });
    return result;
  }

  private getAuditRequestMeta(request: Request) {
    return {
      ip_address: request.ip,
      user_agent: request.get('user-agent') ?? null,
    };
  }
}
