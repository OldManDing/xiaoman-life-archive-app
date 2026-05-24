import { Body, Controller, Get, HttpCode, Patch, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';

import { REFRESH_TOKEN_COOKIE_NAME } from '../../shared/constants';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { isSecureCookieEnvironment } from '../../shared/env-config';
import { AuthenticatedUser } from '../../shared/types';
import { parseDurationToSeconds } from '../../shared/utils';
import { UserJwtAuthGuard } from '../auth/guards/user-jwt-auth.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { CreateMembershipBookRequestDto } from './dto/create-membership-book-request.dto';
import { DeleteMeDto } from './dto/delete-me.dto';
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

  @Get('me/preferences')
  preferences(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.preferences(user.id);
  }

  @Put('me/preferences')
  updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePreferencesDto, @Req() request: Request) {
    return this.usersService.updatePreferences(user.id, dto, this.getAuditRequestMeta(request));
  }

  @Post('me/feedback')
  @HttpCode(200)
  submitFeedback(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFeedbackDto, @Req() request: Request) {
    return this.usersService.submitFeedback(user.id, dto, this.getAuditRequestMeta(request));
  }

  @Post('me/membership-book-requests')
  @HttpCode(200)
  requestMembershipBook(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMembershipBookRequestDto, @Req() request: Request) {
    return this.usersService.requestMembershipBook(user.id, dto, this.getAuditRequestMeta(request));
  }

  @Get('me/deletion-check')
  deletionCheck(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deletionCheck(user.id);
  }

  @Post('me/delete')
  @HttpCode(200)
  async deleteMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeleteMeDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.usersService.deleteMe(user.id, dto);
    const cookieOptions = this.getRefreshCookieOptions();
    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: cookieOptions.httpOnly,
      sameSite: cookieOptions.sameSite,
      secure: cookieOptions.secure,
      path: cookieOptions.path,
    });
    return result;
  }

  private getRefreshCookieOptions() {
    const maxAge = parseDurationToSeconds(process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') * 1000;
    const isSecure = isSecureCookieEnvironment();

    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isSecure,
      path: '/',
      maxAge,
    };
  }

  private getAuditRequestMeta(request: Request) {
    return {
      ip_address: request.ip,
      user_agent: request.get('user-agent') ?? null,
    };
  }
}
