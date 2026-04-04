import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import twilio from 'twilio';
import { Role } from '@shared/enums';
import { prisma } from '../../infra/prisma/prisma-client';
import { AppError } from '../../application/errors';
import { hashAdminPassword } from './password.util';

const FALLBACK_OTP = '123456';

@Injectable()
export class AuthService {
  private get jwtSecret() {
    return process.env.JWT_SECRET || 'dev-secret';
  }

  private get twilioClient(): twilio.Twilio | null {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) return null;
    return twilio(sid, token);
  }

  private get twilioVerifyServiceSid(): string | null {
    return process.env.TWILIO_VERIFY_SERVICE_SID ?? null;
  }

  async requestCustomerOtp(phone: string): Promise<{ requestId: string }> {
    const client = this.twilioClient;
    const serviceSid = this.twilioVerifyServiceSid;
    if (client && serviceSid) {
      const TWILIO_TIMEOUT_MS = 10000;
      await Promise.race([
        client.verify.v2.services(serviceSid).verifications.create({
          to: phone,
          channel: 'sms',
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Twilio request timed out')), TWILIO_TIMEOUT_MS)
        ),
      ]).catch((err) => {
        throw new InternalServerErrorException(
          err?.message ?? 'Could not send OTP. Check Twilio config or try again.'
        );
      });
    }
    return { requestId: phone };
  }

  async verifyCustomerOtp(params: {
    phone: string;
    otp: string;
    requestId?: string;
  }): Promise<{ token: string; user: { id: string; phone: string; role: Role } }> {
    const { phone, otp } = params;
    const client = this.twilioClient;
    const serviceSid = this.twilioVerifyServiceSid;

    if (client && serviceSid) {
      const check = await client.verify.v2
        .services(serviceSid)
        .verificationChecks.create({ to: phone, code: otp });
      if (check.status !== 'approved') {
        throw new UnauthorizedException('Invalid or expired OTP');
      }
    } else {
      if (otp !== FALLBACK_OTP) {
        throw new UnauthorizedException('Invalid OTP');
      }
    }

    const user = await prisma.user.upsert({
      where: { phone },
      update: { role: Role.CUSTOMER },
      create: {
        phone,
        role: Role.CUSTOMER,
      },
    });

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role as Role,
        phone: user.phone,
      },
      this.jwtSecret,
      { expiresIn: '7d' },
    );

    return {
      token,
      user: { id: user.id, phone: user.phone!, role: user.role as Role },
    };
  }

  async adminLogin(params: {
    email: string;
    password: string;
  }): Promise<{ token: string; user: { id: string; email: string; role: Role; branchId?: string | null } }> {
    const { email, password } = params;
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        role: { not: Role.CUSTOMER },
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.isActive === false) {
      throw new AppError('USER_DISABLED', 'User account is disabled', {
        userId: user.id,
        email: user.email,
      });
    }
    // If a password hash exists, verify using configured salt.
    if (user.passwordHash) {
      // Legacy seeded accounts store the literal 'dev-hash'; accept password 'dev-hash'.
      if (user.passwordHash === 'dev-hash' && password === 'dev-hash') {
        // OK
      } else {
        const hash = hashAdminPassword(password);
        if (hash !== user.passwordHash) {
          throw new UnauthorizedException('Invalid credentials');
        }
      }
    } else {
      // No hash: legacy seeded admin password must match exactly.
      if (password !== 'dev-hash') {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role as Role,
        email: user.email,
        branchId: (user as { branchId?: string | null }).branchId ?? null,
      },
      this.jwtSecret,
      { expiresIn: '1h' },
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email!,
        role: user.role as Role,
        branchId: (user as { branchId?: string | null }).branchId ?? null,
      },
    };
  }

  /** Sync profile from mobile app (Supabase Auth). Upserts User by phone and updates name/email. */
  async syncProfileFromSupabase(phone: string, body: { name?: string; email?: string }) {
    if (!phone || (!body.name && body.email === undefined)) {
      return { ok: true };
    }
    await prisma.user.upsert({
      where: { phone },
      update: {
        ...(body.name != null && { name: body.name }),
        ...(body.email != null && { email: body.email }),
      },
      create: {
        phone,
        role: Role.CUSTOMER,
        name: body.name ?? null,
        email: body.email ?? null,
      },
    });
    return { ok: true };
  }
}

