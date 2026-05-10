import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChildrenModule } from './modules/children/children.module';
import { FamiliesModule } from './modules/families/families.module';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';
import { RecordsModule } from './modules/records/records.module';
import { UsersModule } from './modules/users/users.module';
import { AiJobsModule } from './modules/ai-jobs/ai-jobs.module';
import { PrismaModule } from './prisma/prisma.module';
import { validateRuntimeConfig } from './shared/env-config';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '../../.env.local'],
      validate: validateRuntimeConfig,
    }),
    JwtModule.register({}),
    PrismaModule,
    SharedModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ChildrenModule,
    FamiliesModule,
    MediaModule,
    RecordsModule,
    AiJobsModule,
    AdminModule,
  ],
})
export class AppModule {}
