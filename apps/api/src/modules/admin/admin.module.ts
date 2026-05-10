import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AiJobsModule } from '../ai-jobs/ai-jobs.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';

@Module({
  imports: [JwtModule.register({}), AiJobsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminJwtAuthGuard, AdminJwtStrategy, AdminRoleGuard],
})
export class AdminModule {}
