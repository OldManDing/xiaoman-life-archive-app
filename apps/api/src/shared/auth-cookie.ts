import type { CookieOptions } from 'express';

import { isSecureCookieEnvironment } from './env-config';
import { parseDurationToSeconds } from './utils';

export function getRefreshCookieOptions(env: Record<string, unknown> = process.env): CookieOptions {
  const maxAge = parseDurationToSeconds(String(env.JWT_REFRESH_EXPIRES_IN ?? '30d')) * 1000;
  const secure = isSecureCookieEnvironment(env);

  return {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    path: '/',
    maxAge,
  };
}
