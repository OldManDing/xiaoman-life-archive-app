import { Body, Controller, Get, HttpCode, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';

import { REFRESH_TOKEN_COOKIE_NAME } from '../../shared/constants';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { isSecureCookieEnvironment } from '../../shared/env-config';
import { AuthenticatedUser } from '../../shared/types';
import { parseDurationToSeconds } from '../../shared/utils';
import { UserJwtAuthGuard } from '../auth/guards/user-jwt-auth.guard';
import { DeleteMeDto } from './dto/delete-me.dto';
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
}
