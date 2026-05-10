import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserJwtAuthGuard } from './guards/user-jwt-auth.guard';
import { UserJwtStrategy } from './strategies/user-jwt.strategy';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, UserJwtAuthGuard, UserJwtStrategy],
  exports: [UserJwtAuthGuard],
})
export class AuthModule {}
