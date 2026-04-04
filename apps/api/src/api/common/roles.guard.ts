import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@shared/enums';
import { ROLES_KEY } from './roles.decorator';

export interface AuthUser {
  id: string;
  role: Role;
  phone?: string | null;
  email?: string | null;
  /** Set for Branch Head (OPS) and Agent (AGENT); used to scope orders, customers, feedback, etc. */
  branchId?: string | null;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    let requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    requiredRoles = requiredRoles.filter((r): r is Role => r != null);
    if (requiredRoles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;
    if (!user) return false;
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}

