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
import type { SupabaseJwtPayload } from './supabase-jwt.guard';
import type { AdminSignupCompleteDto } from './dto/admin-signup-complete.dto';
import type { AuthUser } from '../common/roles.guard';

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

  /**
   * Issues a short-lived JWT in Supabase user shape so {@link SupabaseJwtGuard} accepts it on
   * POST auth/admin/signup/complete. Only when {@link DevSignupBypassGuard} passed.
   */
  issueDevSupabaseAccessToken(email: string): { accessToken: string } {
    const secret = process.env.SUPABASE_JWT_SECRET?.trim();
    if (!secret) {
      throw new BadRequestException(
        'Set SUPABASE_JWT_SECRET in apps/api/.env (Supabase Dashboard → Settings → API → JWT Secret) to use dev signup bypass.',
      );
    }
    const normalized = email.trim().toLowerCase();
    const sub = randomUUID();
    const accessToken = jwt.sign(
      { sub, email: normalized, aud: 'authenticated', role: 'authenticated' },
      secret,
      { expiresIn: '15m', algorithm: 'HS256' },
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
    supabaseUser: SupabaseJwtPayload,
    dto: AdminSignupCompleteDto,
    branchLogo?: Express.Multer.File,
  ): Promise<{
    token: string;
    user: { id: string; email: string; role: Role; branchId: string | null };
    onboardingCompletedAt: string | null;
  }> {
    const emailFromToken = (supabaseUser.email ?? '').trim().toLowerCase();
    if (!emailFromToken) {
      throw new UnauthorizedException('Email missing from Supabase token');
    }
    if (dto.email.trim().toLowerCase() !== emailFromToken) {
      throw new BadRequestException('Email does not match the verified session');
    }

    this.assertSignupEmailAllowed(emailFromToken);

    const sub = supabaseUser.sub;
    if (!sub) {
      throw new UnauthorizedException('Invalid Supabase subject');
    }

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

    const existingBySub = await prisma.user.findFirst({
      where: { supabaseAuthId: sub },
    });
    if (existingBySub) {
      throw new ConflictException('This Supabase account is already linked to a user');
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
            supabaseAuthId: sub,
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
        if (fields.includes('supabaseAuthId')) {
          throw new ConflictException(
            'This signup session was already used. Go back, request a new code, and try again.',
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
    if (!branch.logoUrl?.trim()) {
      throw new BadRequestException('Upload a branch logo in Branding before finishing onboarding');
    }

    const pinCount = await prisma.serviceArea.count({ where: { branchId } });
    if (pinCount < 1) {
      throw new BadRequestException('Add at least one serviceable pincode for your branch');
    }

    const phoneDigits = (branch.phone ?? '').replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      throw new BadRequestException('Add a valid branch mobile number (10–15 digits) before finishing onboarding');
    }
    if (!branch.termsAndConditions?.trim()) {
      throw new BadRequestException('Add terms and conditions for your branch (shown on invoices) before finishing onboarding');
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
        branchIds: true,
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
