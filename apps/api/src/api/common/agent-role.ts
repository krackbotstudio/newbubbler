import { Role } from '@shared/enums';

/**
 * Use in @Roles(...) instead of Role.AGENT. If a stale build drops AGENT from the
 * Role object, Role.AGENT is undefined and Nest metadata omits Agent → 403 for Agent users.
 */
export const AGENT_ROLE: Role = ((Role as unknown as { AGENT?: Role }).AGENT ?? 'AGENT') as Role;
