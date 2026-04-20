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
  /** Set for PARTIAL_ADMIN: list of branches this user can access/manage. */
  branchIds?: string[];
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
    // Partial admins can use admin/staff endpoints, but branch scope is enforced in controllers/services.
    const isPartialAdminAllowed =
      user.role === Role.PARTIAL_ADMIN &&
      requiredRoles.some((role) =>
        role === Role.ADMIN ||
        role === Role.PARTIAL_ADMIN ||
        role === Role.OPS ||
        role === Role.BILLING ||
        role === Role.AGENT,
      );
    if (!requiredRoles.includes(user.role) && !isPartialAdminAllowed) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}

