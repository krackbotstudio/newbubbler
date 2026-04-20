import { Body, Controller, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RequestCustomerOtpDto,
  VerifyCustomerOtpDto,
} from './dto/customer-otp.dto';
import { CustomerMobileLoginDto } from './dto/customer-mobile-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { SyncProfileDto } from './dto/sync-profile.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { Role } from '@shared/enums';
import type { AuthUser } from '../common/roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('customer/sync-profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  async syncProfile(@CurrentUser() user: AuthUser | undefined, @Body() dto: SyncProfileDto) {
    const phone = user?.phone;
    if (!phone) {
      throw new UnauthorizedException('Phone not in token');
    }
    return this.authService.syncProfileFromSupabase(phone, {
      name: dto.name,
      email: dto.email,
    });
  }

  @Post('customer/otp/request')
  requestCustomerOtp(@Body() dto: RequestCustomerOtpDto) {
    return this.authService.requestCustomerOtp(dto.phone);
  }

  @Post('customer/otp/verify')
  verifyCustomerOtp(@Body() dto: VerifyCustomerOtpDto) {
    return this.authService.verifyCustomerOtp({
      phone: dto.phone,
      otp: dto.otp,
      requestId: dto.requestId ?? dto.phone,
    });
  }

  @Post('customer/mobile/login')
  loginCustomerWithMobile(@Body() dto: CustomerMobileLoginDto) {
    return this.authService.loginCustomerByMobile(dto.phone);
  }

  @Post('admin/login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin({
      email: dto.email,
      password: dto.password,
    });
  }
}

