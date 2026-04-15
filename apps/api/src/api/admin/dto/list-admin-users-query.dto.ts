import { IsEnum, IsOptional, IsString, IsIn } from 'class-validator';
import { Role } from '@shared/enums';

export class ListAdminUsersQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

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
