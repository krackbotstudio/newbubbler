import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import { Role } from '@shared/enums';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard, type AuthUser } from '../common/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AGENT_ROLE } from '../common/agent-role';
import { AdminSignupTokenGuard } from './admin-signup-token.guard';
import { AdminSignupService } from './admin-signup.service';
import { AdminSignupCompleteDto } from './dto/admin-signup-complete.dto';
import { AdminSignupEmailOtpRequestDto, AdminSignupEmailOtpVerifyDto } from './dto/admin-signup-email-otp.dto';

const signupBranchLogoUpload = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, accept: boolean) => void) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new BadRequestException('Branch logo must be an image (PNG, JPG, JPEG, or WebP).'), false);
      return;
    }
    cb(null, true);
  },
};

@Controller('auth/admin')
export class AdminSignupController {
  constructor(private readonly adminSignupService: AdminSignupService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.BILLING, Role.OPS, AGENT_ROLE)
  async profile(@CurrentUser() user: AuthUser | undefined) {
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.adminSignupService.getProfile(user.id);
  }

  /** Send branch-signup OTP to email via Brevo. */
  @Post('signup/request-email-otp')
  async requestEmailOtp(@Body() dto: AdminSignupEmailOtpRequestDto) {
    return this.adminSignupService.requestEmailOtp(dto.email);
  }

  /** Verify emailed OTP and issue short-lived signup token for /signup/complete. */
  @Post('signup/verify-email-otp')
  async verifyEmailOtp(@Body() dto: AdminSignupEmailOtpVerifyDto) {
    return this.adminSignupService.verifyEmailOtp(dto);
  }

  @Post('signup/complete')
  @UseGuards(AdminSignupTokenGuard)
  @UseInterceptors(FileInterceptor('branchLogo', signupBranchLogoUpload))
  async complete(
    @Req() req: { signupEmail: string },
    @Body() dto: AdminSignupCompleteDto,
    @UploadedFile() branchLogo?: Express.Multer.File,
  ) {
    return this.adminSignupService.complete(req.signupEmail, dto, branchLogo);
  }

  @Post('onboarding/finish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OPS)
  async finishOnboarding(@CurrentUser() user: AuthUser | undefined) {
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.adminSignupService.finishOnboarding(user);
  }
}
