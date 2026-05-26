import { INestApplication } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { isSecureCookieEnvironment } from './env-config';

const apiContentSecurityPolicy = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export function applySecurityHeaders(app: INestApplication) {
  const httpServer = app.getHttpAdapter().getInstance() as { disable?: (setting: string) => void };
  httpServer.disable?.('x-powered-by');

  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Content-Security-Policy', apiContentSecurityPolicy);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    if (isSecureCookieEnvironment()) {
      response.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }

    next();
  });
}
