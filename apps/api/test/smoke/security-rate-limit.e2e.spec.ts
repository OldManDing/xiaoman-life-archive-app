import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ApiExceptionFilter } from '../../src/shared/api-exception.filter';
import { ApiResponseInterceptor } from '../../src/shared/api-response.interceptor';
import { createAppValidationPipe } from '../../src/shared/validation-pipe';

describe('Security rate limiting', () => {
  let app: INestApplication;
  const previousLimit = process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS;
  const previousWindow = process.env.AUTH_RATE_LIMIT_WINDOW_MS;

  beforeAll(async () => {
    process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS = '2';
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        userAuthAccount: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createAppValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    if (previousLimit === undefined) {
      delete process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS;
    } else {
      process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS = previousLimit;
    }

    if (previousWindow === undefined) {
      delete process.env.AUTH_RATE_LIMIT_WINDOW_MS;
    } else {
      process.env.AUTH_RATE_LIMIT_WINDOW_MS = previousWindow;
    }

    if (app) await app.close();
  });

  it('blocks repeated password login attempts from the same client', async () => {
    const payload = {
      login_type: 'password',
      credential: 'rate_limit_parent',
      password: 'WrongPass123!',
    };

    await request(app.getHttpServer()).post('/api/v1/auth/login').send(payload).expect(401);
    await request(app.getHttpServer()).post('/api/v1/auth/login').send(payload).expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(payload)
      .expect(429)
      .expect((response) => {
        expect(response.body).toMatchObject({
          code: 1011,
          data: null,
        });
      });
  });
});
