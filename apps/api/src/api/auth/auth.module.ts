import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { AdminSignupController } from './admin-signup.controller';
import { AdminSignupService } from './admin-signup.service';
import { AdminSignupTokenGuard } from './admin-signup-token.guard';

@Module({
  controllers: [AuthController, MeController, AdminSignupController],
  providers: [AuthService, MeService, AdminSignupService, AdminSignupTokenGuard],
})export class AuthModule {}

