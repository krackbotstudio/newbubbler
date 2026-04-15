import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateSegmentCategoryDto {
  @IsString()
  code!: string;

  @IsString()
  label!: string;

  /** Required when caller is ADMIN (which branch owns this segment). Ignored for OPS (uses assigned branch). */
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
