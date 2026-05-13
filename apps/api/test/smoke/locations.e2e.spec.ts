import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ApiExceptionFilter } from '../../src/shared/api-exception.filter';
import { ApiResponseInterceptor } from '../../src/shared/api-response.interceptor';

describe('Locations smoke', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const user = {
    id: BigInt(1),
    userNo: 'u_001',
    nickname: '定位用户',
    status: 1,
    deletedAt: null,
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    process.env.MAP_PROVIDER = 'mock';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        user: {
          findFirst: jest.fn().mockResolvedValue(user),
        },
        $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
      })
      .compile();

    app = moduleRef.createNestApplication();
    jwtService = moduleRef.get(JwtService);
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('returns localized location suggestions for authenticated users', async () => {
    const token = await jwtService.signAsync(
      { type: 'user', sub: user.id.toString(), user_no: user.userNo },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/locations/search')
      .query({ keyword: '公园' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      provider: 'mock',
      list: expect.arrayContaining([
        expect.objectContaining({
          name: '公园',
          source: 'local',
        }),
      ]),
    });
  });

  it('requires login before searching locations', async () => {
    await request(app.getHttpServer()).get('/api/v1/locations/search').query({ keyword: '公园' }).expect(401);
  });
});
