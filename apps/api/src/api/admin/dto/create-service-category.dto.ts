import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateServiceCategoryDto {
  @IsString()
  code!: string;

  @IsString()
  label!: string;

  /** Required when caller is ADMIN. Ignored for OPS (uses assigned branch). */
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
