import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ApiExceptionFilter } from './shared/api-exception.filter';
import { getAppPort, resolveCorsOrigins } from './shared/env-config';
import { ApiResponseInterceptor } from './shared/api-response.interceptor';
import { createAppValidationPipe } from './shared/validation-pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
