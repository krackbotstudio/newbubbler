import { IsEmail, Matches } from 'class-validator';

export class AdminSignupEmailOtpRequestDto {
  @IsEmail()
  email!: string;
}

export class AdminSignupEmailOtpVerifyDto {
  @IsEmail()
  email!: string;

  @Matches(/^\d{6}$/)
  otp!: string;
}
