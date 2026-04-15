import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { AdminSignupController } from './admin-signup.controller';
import { AdminSignupService } from './admin-signup.service';
import { SupabaseJwtGuard } from './supabase-jwt.guard';
import { DevSignupBypassGuard } from './dev-signup-bypass.guard';

@Module({
  controllers: [AuthController, MeController, AdminSignupController],
  providers: [AuthService, MeService, AdminSignupService, SupabaseJwtGuard, DevSignupBypassGuard],
})export class AuthModule {}

