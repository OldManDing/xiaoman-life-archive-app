import { Body, Controller, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';

import { REFRESH_TOKEN_COOKIE_NAME } from '../../shared/constants';
import { Public } from '../../shared/decorators/public.decorator';
import { isSecureCookieEnvironment } from '../../shared/env-config';
import { parseDurationToSeconds } from '../../shared/utils';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { UserJwtAuthGuard } from './guards/user-jwt-auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
@UseGuards(UserJwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(200)
  @Post('send-code')
  sendCode(@Body() dto: SendCodeDto) {
    return this.authService.sendLoginCode(dto.mobile);
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(response, result.refresh_token);

    const { refresh_token: _refreshToken, ...payload } = result;
    return payload;
  }

  @Public()
  @HttpCode(200)
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.register(dto);
    this.setRefreshCookie(response, result.refresh_token);

    const { refresh_token: _refreshToken, ...payload } = result;
    return payload;
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = this.getRefreshTokenFromRequest(request);
    if (!refreshToken) {
      throw new UnauthorizedException('登录状态已失效');
    }

    const result = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(response, result.refresh_token);

    const { refresh_token: _refreshToken, payload: _payload, ...payload } = result;
    return payload;
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = this.getRefreshTokenFromRequest(request);
    await this.authService.logout(refreshToken);
    const cookieOptions = this.getRefreshCookieOptions();
    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: cookieOptions.httpOnly,
      sameSite: cookieOptions.sameSite,
      secure: cookieOptions.secure,
      path: cookieOptions.path,
    });
    return { success: true };
  }

  private getRefreshTokenFromRequest(request: Request): string | null {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return null;

    const cookies = cookieHeader
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean);

    for (const cookie of cookies) {
      const [name, ...valueParts] = cookie.split('=');
      if (name === REFRESH_TOKEN_COOKIE_NAME) {
        return decodeURIComponent(valueParts.join('='));
      }
    }

    return null;
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    response.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, this.getRefreshCookieOptions());
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
