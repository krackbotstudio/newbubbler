import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { Role } from '@shared/enums';
import { Prisma, type User } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../../infra/prisma/prisma-client';
import { STORAGE_ADAPTER } from '../../infra/infra.module';
import type { StorageAdapter } from '../../application/ports';
import { hashAdminPassword } from './password.util';
import type { AdminSignupCompleteDto } from './dto/admin-signup-complete.dto';
import type { AuthUser } from '../common/roles.guard';

type PendingSignupOtp = {
  otp: string;
  expiresAtMs: number;
  sentAtMs: number;
};

function sanitizeOriginalName(name: string): string {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'file';
}

function extFromOriginalName(name: string): string {
  const clean = sanitizeOriginalName(name);
  const ext = path.extname(clean).toLowerCase();
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext;
  return '.png';
}

@Injectable()
export class AdminSignupService {
  private readonly signupOtps = new Map<string, PendingSignupOtp>();

  constructor(
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
  ) {}

  private get jwtSecret() {
    return process.env.JWT_SECRET || 'dev-secret';
  }

  /** Writes branch logo next to other branch assets; returns public URL path. */
  private async persistBranchLogo(branchId: string, file: Express.Multer.File): Promise<string> {
    const buf = file.buffer;
    if (!buf?.length) {
      throw new BadRequestException('Branch logo file is empty');
    }
    const ext = extFromOriginalName(file.originalname);
    const fileName = `branch-${branchId}-logo-${randomUUID()}${ext}`;
    const key = `branding/branches/${fileName}`;
    const uploaded = await this.storageAdapter.putObject(key, buf, file.mimetype || 'image/png');
    return typeof uploaded === 'string' && uploaded.length > 0
      ? uploaded
      : `/api/assets/branding/branches/${fileName}`;
  }

  private get signupOtpTtlMinutes(): number {
    const raw = Number(process.env.BREVO_SIGNUP_OTP_TTL_MINUTES ?? 10);
    if (!Number.isFinite(raw)) return 10;
    return Math.min(30, Math.max(3, Math.floor(raw)));
  }

  private get allowDevSignupBypass(): boolean {
    const raw = process.env.ALLOW_DEV_SIGNUP_BYPASS?.trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
  }

  private createSixDigitOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private async sendBrevoSignupOtp(email: string, otp: string): Promise<void> {
    const apiKey = process.env.BREVO_API_KEY?.trim();
    const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
    const senderName = process.env.BREVO_SENDER_NAME?.trim() || 'Bubbler';
    if (!apiKey || !senderEmail) {
      throw new BadRequestException(
        'Email verification is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL in apps/api/.env.',
      );
    }
    const subject = process.env.BREVO_SIGNUP_OTP_SUBJECT?.trim() || 'Your Bubbler verification code';
    const ttl = this.signupOtpTtlMinutes;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; color:#111;">
        <p>Your verification code is:</p>
        <p style="font-size: 22px; font-weight: 700; letter-spacing: 4px; margin: 8px 0;">${otp}</p>
        <p>This code expires in ${ttl} minutes.</p>
      </div>
    `;
    const textContent = `Your verification code is ${otp}. It expires in ${ttl} minutes.`;
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email }],
        subject,
        htmlContent,
        textContent,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new BadRequestException(`Could not send verification email (${res.status}). ${body || ''}`.trim());
    }
  }

  async requestEmailOtp(emailRaw: string): Promise<{ ok: true }> {
    const email = emailRaw.trim().toLowerCase();
    this.assertSignupEmailAllowed(email);

    const existingSameEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { role: true },
    });
    if (existingSameEmail) {
      if (existingSameEmail.role !== Role.CUSTOMER) {
        throw new ConflictException('An admin account with this email already exists. Sign in instead.');
      }
      throw new ConflictException(
        'This email is already registered as a customer account. Use a different email for branch signup, or contact support.',
      );
    }

    const otp = this.allowDevSignupBypass ? '123456' : this.createSixDigitOtp();
    await this.sendBrevoSignupOtp(email, otp);
    const now = Date.now();
    this.signupOtps.set(email, {
      otp,
      sentAtMs: now,
      expiresAtMs: now + this.signupOtpTtlMinutes * 60 * 1000,
    });
    return { ok: true };
  }

  async verifyEmailOtp(params: { email: string; otp: string }): Promise<{ accessToken: string }> {
    const email = params.email.trim().toLowerCase();
    const otp = params.otp.trim();
    if (this.allowDevSignupBypass && otp === '123456') {
      const accessToken = jwt.sign(
        {
          purpose: 'admin_signup',
          email,
        },
        this.jwtSecret,
        { expiresIn: '20m' },
      );
      return { accessToken };
    }
    const pending = this.signupOtps.get(email);
    if (!pending) {
      throw new UnauthorizedException('No pending verification for this email. Request a new code.');
    }
    if (Date.now() > pending.expiresAtMs) {
      this.signupOtps.delete(email);
      throw new UnauthorizedException('Verification code expired. Request a new code.');
    }
    if (pending.otp !== otp) {
      throw new UnauthorizedException('Invalid verification code.');
    }
    this.signupOtps.delete(email);
    const accessToken = jwt.sign(
      {
        purpose: 'admin_signup',
        email,
      },
      this.jwtSecret,
      { expiresIn: '20m' },
    );
    return { accessToken };
  }

  private assertSignupEmailAllowed(email: string): void {
    const raw = process.env.ALLOWED_SIGNUP_DOMAINS?.trim();
    if (!raw) return;
    const domain = email.split('@')[1]?.toLowerCase();
    const allowed = raw
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (!domain || !allowed.includes(domain)) {
      throw new ForbiddenException('Sign up is restricted to approved email domains.');
    }
  }

  async complete(
    verifiedEmail: string,
    dto: AdminSignupCompleteDto,
    branchLogo?: Express.Multer.File,
  ): Promise<{
    token: string;
    user: { id: string; email: string; role: Role; branchId: string | null };
    onboardingCompletedAt: string | null;
  }> {
    const emailFromToken = verifiedEmail.trim().toLowerCase();
    if (!emailFromToken) {
      throw new UnauthorizedException('Email missing from verified signup token');
    }
    if (dto.email.trim().toLowerCase() !== emailFromToken) {
      throw new BadRequestException('Email does not match the verified session');
    }

    this.assertSignupEmailAllowed(emailFromToken);

    const existingSameEmail = await prisma.user.findFirst({
      where: { email: { equals: emailFromToken, mode: 'insensitive' } },
    });
    if (existingSameEmail) {
      if (existingSameEmail.role !== Role.CUSTOMER) {
        throw new ConflictException('An admin account with this email already exists. Sign in instead.');
      }
      throw new ConflictException(
        'This email is already registered as a customer account. Use a different email for branch signup, or contact support.',
      );
    }

    const branchCount = await prisma.branch.count();
    const isDefault = branchCount === 0;

    const passwordHash = hashAdminPassword(dto.password);

    const phoneTrimmed = dto.branchPhone.trim();
    const phoneDigits = phoneTrimmed.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      throw new BadRequestException(
        'Branch phone must include between 10 and 15 digits (country code optional).',
      );
    }

    let result: { user: User; branch: { id: string } };
    try {
      result = await prisma.$transaction(async (tx) => {
        const branch = await tx.branch.create({
          data: {
            name: dto.branchName.trim(),
            address: dto.branchAddress.trim(),
            phone: phoneTrimmed,
            isDefault,
            email: dto.branchContactEmail?.trim() ?? null,
            gstNumber: dto.gstNumber?.trim() ?? null,
            panNumber: dto.panNumber?.trim() ?? null,
            footerNote: dto.footerNote?.trim() ?? null,
            upiId: dto.upiId?.trim() ?? null,
            upiPayeeName: dto.upiPayeeName?.trim() ?? null,
            upiLink: dto.upiLink?.trim() ?? null,
          },
        });

        await tx.operatingHours.create({
          data: {
            branchId: branch.id,
            startTime: '09:00',
            endTime: '18:00',
          },
        });

        /** OPS = branch head for this tenant branch (manages onboarding, branding, service area). */
        const user = await tx.user.create({
          data: {
            email: emailFromToken,
            name: dto.name?.trim() || null,
            role: Role.OPS,
            branchId: branch.id,
            passwordHash,
            onboardingCompletedAt: null,
            isActive: true,
          },
        });

        return { user, branch };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = e.meta?.target;
        const fields = Array.isArray(target) ? target.join(', ') : String(target ?? '');
        if (fields.includes('email')) {
          throw new ConflictException(
            'This email is already registered. Use a different email or sign in.',
          );
        }
        throw new ConflictException('Could not create this account because a unique field already exists.');
      }
      throw e;
    }

    if (branchLogo?.buffer?.length) {
      const logoUrl = await this.persistBranchLogo(result.branch.id, branchLogo);
      await prisma.branch.update({
        where: { id: result.branch.id },
        data: { logoUrl },
      });
    }

    const token = jwt.sign(
      {
        sub: result.user.id,
        role: result.user.role as Role,
        email: result.user.email,
        branchId: result.user.branchId ?? null,
      },
      this.jwtSecret,
      { expiresIn: '1h' },
    );

    return {
      token,
      user: {
        id: result.user.id,
        email: result.user.email!,
        role: result.user.role as Role,
        branchId: result.user.branchId,
      },
      onboardingCompletedAt: null,
    };
  }

  async finishOnboarding(authUser: AuthUser): Promise<{ ok: true }> {
    if (authUser.role !== Role.OPS) {
      throw new ForbiddenException('Only branch heads can complete onboarding');
    }
    const branchId = authUser.branchId;
    if (!branchId) {
      throw new BadRequestException('Your account is not assigned to a branch');
    }

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw new BadRequestException('Branch not found');
    }

    const pinCount = await prisma.serviceArea.count({ where: { branchId } });
    if (pinCount < 1) {
      throw new BadRequestException('Add at least one serviceable pincode for your branch');
    }

    const phoneDigits = (branch.phone ?? '').replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      throw new BadRequestException('Add a valid branch mobile number (10–15 digits) before finishing onboarding');
    }

    await prisma.user.update({
      where: { id: authUser.id },
      data: { onboardingCompletedAt: new Date() },
    });

    return { ok: true };
  }

  async getProfile(userId: string) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        branchId: true,
        onboardingCompletedAt: true,
      },
    });
    if (!u || u.role === Role.CUSTOMER) {
      throw new NotFoundException('User not found');
    }
    return {
      ...u,
      onboardingCompletedAt: u.onboardingCompletedAt?.toISOString() ?? null,
    };
  }
}
