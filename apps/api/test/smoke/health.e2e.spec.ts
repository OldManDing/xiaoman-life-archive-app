import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ApiExceptionFilter } from '../../src/shared/api-exception.filter';
import { ApiResponseInterceptor } from '../../src/shared/api-response.interceptor';
import { applySecurityHeaders } from '../../src/shared/security-headers';

describe('Health smoke', () => {
  let app: INestApplication;
  const previousAppEnv = process.env.APP_ENV;
  const previousStorageProvider = process.env.STORAGE_PROVIDER;
  const previousAiProvider = process.env.AI_PROVIDER;
  const previousMapProvider = process.env.MAP_PROVIDER;
  const previousMapApiKey = process.env.MAP_API_KEY;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      })
      .compile();

    app = moduleRef.createNestApplication();
    applySecurityHeaders(app);
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    if (previousAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = previousAppEnv;
    }
    if (previousStorageProvider === undefined) {
      delete process.env.STORAGE_PROVIDER;
    } else {
      process.env.STORAGE_PROVIDER = previousStorageProvider;
    }
    if (previousAiProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = previousAiProvider;
    }
    if (previousMapProvider === undefined) {
      delete process.env.MAP_PROVIDER;
    } else {
      process.env.MAP_PROVIDER = previousMapProvider;
    }
    if (previousMapApiKey === undefined) {
      delete process.env.MAP_API_KEY;
    } else {
      process.env.MAP_API_KEY = previousMapApiKey;
    }

    if (app) await app.close();
  });

  it('returns wrapped health status', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({
      code: 0,
      message: 'success',
      data: {
        status: 'ok',
        database: 'up',
        providers: {
          map: 'mock',
        },
      },
    });

    expect(typeof response.body.data.timestamp).toBe('string');
  });

  it('returns baseline security headers', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['content-security-policy']).toBe("default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('adds HSTS when the API runs in a secure-cookie environment', async () => {
    process.env.APP_ENV = 'production';
    process.env.STORAGE_PROVIDER = 'minio';
    process.env.AI_PROVIDER = 'openai-compatible';
    process.env.MAP_PROVIDER = 'amap';
    process.env.MAP_API_KEY = 'test-map-key';

    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.headers['strict-transport-security']).toBe('max-age=15552000; includeSubDomains');
  });
});
