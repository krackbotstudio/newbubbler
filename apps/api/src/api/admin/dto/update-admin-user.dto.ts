import { IsString, IsIn, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Role } from '@shared/enums';

const CREATABLE_STAFF_ROLE_VALUES = ['ADMIN', 'PARTIAL_ADMIN', 'OPS', 'AGENT'] as const;

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  name?: string | null;

  @IsOptional()
  @IsIn(CREATABLE_STAFF_ROLE_VALUES, {
    message: 'Only Admin, Partial Admin, Branch Head, and Agent roles are allowed',
  })
  role?: Role;

  @IsOptional()
  @IsString()
  branchId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isActive?: boolean;
}
