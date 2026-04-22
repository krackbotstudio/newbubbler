import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

function isDevBypassEnvEnabled(): boolean {
  const raw = process.env.ALLOW_DEV_SIGNUP_BYPASS?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

/**
 * Allows dev-only admin signup helpers. Never enable ALLOW_DEV_SIGNUP_BYPASS in production.
 */
@Injectable()
export class DevSignupBypassGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // Allow if explicitly enabled via environment variable (even in production)
    if (!isDevBypassEnvEnabled()) {
      throw new ForbiddenException(
        'Dev signup bypass is not enabled. Set ALLOW_DEV_SIGNUP_BYPASS=true in apps/api/.env and restart the API.',
      );
    }
    return true;
  }
}