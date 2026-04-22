import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

type SignupTokenPayload = {
  purpose?: string;
  email?: string;
};

@Injectable()
export class AdminSignupTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers?: Record<string, string | undefined>; signupEmail?: string }>();
    const auth = req.headers?.authorization ?? req.headers?.Authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing signup token');
    }
    const token = auth.slice(7);
    const secret = process.env.JWT_SECRET || 'dev-secret';
    try {
      const payload = jwt.verify(token, secret) as SignupTokenPayload;
      if (payload.purpose !== 'admin_signup' || !payload.email) {
        throw new UnauthorizedException('Invalid signup token');
      }
      req.signupEmail = String(payload.email).trim().toLowerCase();
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired signup token');
    }
  }
}
