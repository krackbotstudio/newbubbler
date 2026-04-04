import { IsString, IsEmail, IsIn, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Role } from '@shared/enums';

/** Literal list so validation works even if a stale shared build omits `Role.AGENT`. */
const CREATABLE_STAFF_ROLE_VALUES = ['ADMIN', 'OPS', 'AGENT'] as const;

export class CreateAdminUserDto {
  @IsOptional()
  @IsString()
  name?: string | null;

  @IsEmail()
  email!: string;

  @IsIn(CREATABLE_STAFF_ROLE_VALUES, {
    message: 'Only Admin, Branch Head, and Agent roles are allowed',
  })
  role!: Role;

  @IsOptional()
  @IsString()
  branchId?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isActive?: boolean;
}
