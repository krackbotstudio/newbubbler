import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { Role } from '@shared/enums';
import type { AuthUser } from './roles.guard';
import { prisma } from '../../infra/prisma/prisma-client';

interface JwtPayload {
  sub: string;
  role: Role;
  phone?: string | null;
  email?: string | null;
  branchId?: string | null;
  branchIds?: string[];
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader.slice('Bearer '.length);
    const secret = process.env.JWT_SECRET || 'dev-secret';
    try {
      const payload = jwt.verify(token, secret) as JwtPayload;
      let branchId = payload.branchId ?? null;
      let branchIds = Array.isArray(payload.branchIds) ? payload.branchIds : [];

      // Keep branch scope in sync even if JWT was minted before assignment changes.
      if (payload.role !== Role.CUSTOMER) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { branchId: true, branchIds: true },
          });
          if (dbUser) {
            branchId = dbUser.branchId ?? null;
            branchIds = Array.isArray(dbUser.branchIds) ? dbUser.branchIds : [];
          }
        } catch {
          // Best-effort sync; fallback to JWT payload values on DB read failures.
        }
      }

      const user: AuthUser = {
        id: payload.sub,
        role: payload.role,
        phone: payload.phone,
        email: payload.email,
        branchId,
        branchIds,
      };
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

