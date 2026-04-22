import { IsOptional, IsString, IsIn } from 'class-validator';

/**
 * Must be string literals — do not derive from `Role` enum. A stale or duplicated `@shared/enums`
 * build can leave `Role.AGENT` undefined at runtime, which makes `@IsIn([...Role])` drop AGENT from
 * validation and reject `?role=AGENT` with a message ending in `BILLING, "`.
 */
export const ADMIN_USERS_LIST_ROLE_QUERY_VALUES = [
  'CUSTOMER',
  'ADMIN',
  'OPS',
  'BILLING',
  'AGENT',
] as const;

export class ListAdminUsersQueryDto {
  @IsOptional()
  @IsIn([...ADMIN_USERS_LIST_ROLE_QUERY_VALUES])
  role?: (typeof ADMIN_USERS_LIST_ROLE_QUERY_VALUES)[number];

  @IsOptional()
  @IsIn(['true', 'false'])
  active?: 'true' | 'false';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  /** ADMIN only: filter list to a branch (ignored for OPS; they are always scoped to their branch). */
  @IsOptional()
  @IsString()
  branchId?: string;
}
