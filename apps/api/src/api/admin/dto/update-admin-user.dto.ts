import { IsString, IsIn, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Role } from '@shared/enums';

const CREATABLE_STAFF_ROLE_VALUES = ['ADMIN', 'OPS', 'AGENT'] as const;

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  name?: string | null;

  @IsOptional()
  @IsIn(CREATABLE_STAFF_ROLE_VALUES, {
    message: 'Only Admin, Branch Head, and Agent roles are allowed',
  })
  role?: Role;

  @IsOptional()
  @IsString()
  branchId?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isActive?: boolean;
}
