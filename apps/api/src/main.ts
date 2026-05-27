import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ApiExceptionFilter } from './shared/api-exception.filter';
import { getAppPort, isStrictEnvironment, resolveCorsOrigins } from './shared/env-config';
import { ApiResponseInterceptor } from './shared/api-response.interceptor';
import { applySecurityHeaders } from './shared/security-headers';
import { createAppValidationPipe } from './shared/validation-pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  if (isStrictEnvironment()) {
    const httpServer = app.getHttpAdapter().getInstance() as { set?: (name: string, value: unknown) => void };
    httpServer.set?.('trust proxy', 1);
  }

  applySecurityHeaders(app);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(createAppValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });

  const port = getAppPort();
  await app.listen(port);
}

void bootstrap();
